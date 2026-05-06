import {
    generateGeneralChatResponse,
    planStructuredRequest,
} from './aiService.js';
import { runPythonAnalysis } from './analysisRunner.js';
import { executeQueryPlan } from './dbService.js';
import { formatAnalysisResponse, formatQueryResponse } from './resultFormatter.js';
import { buildSchemaRegistry, getColumnConfig } from './schemaRegistry.js';
import {
    buildQueryPlan,
    validateStructuredRequest,
} from './queryBuilder.js';

// Normal chat replies and structured analytics replies share the same API
// shape so the frontend can render both without branching on transport format.
function buildGeneralResponse(message, usage = {}) {
    return {
        structuredRequest: null,
        message,
        summary: 'General AI response generated.',
        data: null,
        execution: {
            type: 'general_ai',
        },
        tokenUsage: usage,
    };
}

function isLikelyAnalyticsQuestion(message, schemaRegistry) {
    if (schemaRegistry.size === 0) {
        return false;
    }

    // This is a lightweight router, not a second model call. We bias toward
    // obvious analytics wording plus known table/column names from the active
    // schema registry.
    const normalizedMessage = message.toLowerCase();
    const analyticsKeywords = [
        'how many',
        'number of',
        'show me',
        'list',
        'find',
        'give me',
        'count',
        'sum',
        'total',
        'average',
        'avg',
        'group by',
        'trend',
        'distribution',
        'compare',
        'comparison',
        'highest',
        'lowest',
        'top ',
        'bottom ',
        'filter',
        'rows',
        'records',
        'table',
        'tables',
        'column',
        'columns',
        'schema',
        'dataset',
        'student',
        'students',
        'teacher',
        'teachers',
        'school',
        'schools',
        'finance',
        'academic',
        'risk',
        'support',
        'sales',
        'revenue',
    ];

    if (analyticsKeywords.some((keyword) => normalizedMessage.includes(keyword))) {
        return true;
    }

    return Array.from(schemaRegistry.values()).some((table) => {
        if (normalizedMessage.includes(table.name.replace(/_/g, ' '))) {
            return true;
        }

        return table.columns.some((column) =>
            normalizedMessage.includes(column.normalizedName.replace(/_/g, ' '))
        );
    });
}

function isLikelyExternalWorldQuestion(message) {
    const normalizedMessage = (message || '').trim().toLowerCase();

    if (!normalizedMessage) {
        return false;
    }

    const externalWorldKeywords = [
        'weather',
        'temperature',
        'rain',
        'forecast',
        'tomorrow',
        'today',
        'news',
        'headline',
        'stock',
        'bitcoin',
        'price',
        'exchange rate',
        'football',
        'soccer',
        'nba',
        'movie',
        'restaurant',
        'flight',
        'hotel',
        'traffic',
        'earthquake',
    ];

    return externalWorldKeywords.some((keyword) => normalizedMessage.includes(keyword));
}

function isClearlyGeneralConversation(message) {
    const normalizedMessage = (message || '').trim().toLowerCase();

    if (!normalizedMessage) {
        return true;
    }

    const generalPatterns = [
        /^hi\b/,
        /^hello\b/,
        /^hey\b/,
        /^how are you\b/,
        /^who are you\b/,
        /^tell me a joke\b/,
        /^write (me )?(an?|the)\b/,
        /^draft (me )?(an?|the)\b/,
        /^improve this sentence\b/,
        /^translate\b/,
        /^proofread\b/,
    ];

    return generalPatterns.some((pattern) => pattern.test(normalizedMessage));
}

function shouldIncludeDebugPayload(message) {
    const normalizedMessage = (message || '').toLowerCase();
    const asksForJson = /\bjson\b/.test(normalizedMessage);
    const asksForSql = /\bsql\b|\bquery\b/.test(normalizedMessage);
    const asksForRequest = /\bstructured request\b|\brequest payload\b/.test(normalizedMessage);
    return asksForJson || asksForSql || asksForRequest;
}

function isGenderBreakdownQuestion(message) {
    return /\bmale\b|\bfemale\b|\bgender\b|\bsex\b/i.test(message || '');
}

const YEAR_LEVEL_WORD_TO_NUMBER = Object.freeze({
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
});

function isCountStudentsByYearLevelQuestion(message) {
    const normalizedMessage = String(message || '').toLowerCase();

    return (
        /\bstudent\b|\bstudents\b/.test(normalizedMessage) &&
        /\bhow many\b|\bnumber of\b|\bcount\b|\btotal\b/.test(normalizedMessage) &&
        /\b(?:year|yr|form)\s+(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/.test(normalizedMessage)
    );
}

function extractYearLevelLabel(message) {
    const normalizedMessage = String(message || '').toLowerCase();
    const digitMatch = normalizedMessage.match(/\b(?:year|yr|form)\s+(\d{1,2})\b/);

    if (digitMatch?.[1]) {
        return `Year ${Number(digitMatch[1])}`;
    }

    const wordMatch = normalizedMessage.match(/\b(?:year|yr|form)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/);

    if (wordMatch?.[1] && YEAR_LEVEL_WORD_TO_NUMBER[wordMatch[1]]) {
        return `Year ${YEAR_LEVEL_WORD_TO_NUMBER[wordMatch[1]]}`;
    }

    return null;
}

function extractGenderFilterValues(message) {
    const normalizedMessage = String(message || '').toLowerCase();

    if (/\bfemale\b|\bgirl\b|\bgirls\b/.test(normalizedMessage)) {
        return ['female', 'Female', 'FEMALE', 'f', 'F'];
    }

    if (/\bmale\b|\bboy\b|\bboys\b/.test(normalizedMessage)) {
        return ['male', 'Male', 'MALE', 'm', 'M'];
    }

    return null;
}

function buildYearLevelFilterVariants(label) {
    const yearNumberMatch = String(label || '').match(/(\d{1,2})$/);
    const yearNumber = yearNumberMatch?.[1] || null;
    const variants = new Set([
        label,
        label.toLowerCase(),
        label.toUpperCase(),
    ]);

    if (yearNumber) {
        variants.add(yearNumber);
        variants.add(`Yr ${yearNumber}`);
        variants.add(`yr ${yearNumber}`);
        variants.add(`YEAR ${yearNumber}`);
        variants.add(`Form ${yearNumber}`);
        variants.add(`form ${yearNumber}`);
    }

    return Array.from(variants);
}

function isTeacherQualificationCountQuestion(message) {
    const normalizedMessage = String(message || '').toLowerCase();

    return (
        /\bteacher\b|\bteachers\b/.test(normalizedMessage) &&
        /\bqualification\b|\bqualified\b|\bdegree\b|\bbachelor\b|\bmasters\b|\bmaster\b|\bdiploma\b|\bphd\b|\bdoctorate\b/.test(normalizedMessage) &&
        /\bhow many\b|\bnumber of\b|\bcount\b|\btotal\b/.test(normalizedMessage)
    );
}

function normalizeExtractedQualificationValue(value) {
    return String(value || '')
        .trim()
        .replace(/^[\s"']+|[\s"']+$/g, '')
        .replace(/\bteachers?\b.*$/i, '')
        .replace(/\bwith\b.*$/i, '')
        .replace(/\bin\b.*$/i, '')
        .replace(/\bby\b.*$/i, '')
        .trim();
}

function extractQualificationLabel(message) {
    const rawMessage = String(message || '').trim();
    const patterns = [
        /\bqualification(?:\s+of)?\s+([a-z0-9][a-z0-9\s/&-]{1,50})$/i,
        /\bwith\s+([a-z0-9][a-z0-9\s/&-]{1,50})\s+qualification\b/i,
        /\bqualified\s+([a-z0-9][a-z0-9\s/&-]{1,50})\b/i,
    ];

    for (const pattern of patterns) {
        const match = rawMessage.match(pattern);

        if (match?.[1]) {
            const normalized = normalizeExtractedQualificationValue(match[1]);

            if (normalized) {
                return normalized;
            }
        }
    }

    const knownQualifications = [
        'bachelor',
        'masters',
        'master',
        'diploma',
        'phd',
        'doctorate',
        'certificate',
    ];

    const normalizedMessage = rawMessage.toLowerCase();
    const matchedQualification = knownQualifications.find((value) =>
        normalizedMessage.includes(value)
    );

    return matchedQualification || null;
}

function buildTeacherQualificationCountRequest(message, registry) {
    if (!isTeacherQualificationCountQuestion(message)) {
        return null;
    }

    const qualificationTable = registry.get('base_qualification');
    const qualificationLabel = extractQualificationLabel(message);

    if (!qualificationTable || !qualificationLabel) {
        return null;
    }

    const primaryQualificationColumn = getColumnConfig(qualificationTable, 'qualification_level')
        ? 'qualification_level'
        : (getColumnConfig(qualificationTable, 'other_qualification_level')
            ? 'other_qualification_level'
            : null);

    if (!primaryQualificationColumn) {
        return null;
    }

    return {
        type: 'query',
        table: 'base_qualification',
        joins: [],
        operation: 'count',
        columns: [],
        filters: {
            logic: 'and',
            conditions: [
                {
                    column: primaryQualificationColumn,
                    operator: '=',
                    value: qualificationLabel,
                },
            ],
        },
        group_by: [],
        order_by: [],
        limit: 25,
    };
}

function getStudentGenderColumnReference(registry) {
    const studentTable = registry.get('base_student');
    const studentProfileTable = registry.get('base_studentprofile');

    if (studentTable && getColumnConfig(studentTable, 'gender')) {
        return {
            column: 'gender',
            joins: [],
        };
    }

    if (studentProfileTable && getColumnConfig(studentProfileTable, 'gender')) {
        return {
            column: 'base_studentprofile.gender',
            joins: ['base_studentprofile'],
        };
    }

    return null;
}

function buildStudentYearLevelCountRequest(message, registry) {
    if (!isCountStudentsByYearLevelQuestion(message)) {
        return null;
    }

    const studentTable = registry.get('base_student');
    const schoolingProfileTable = registry.get('base_schoolingprofile');
    const educationLevelTable = registry.get('base_educationlevel');
    const yearLevelLabel = extractYearLevelLabel(message);

    if (!studentTable || !schoolingProfileTable || !educationLevelTable || !yearLevelLabel) {
        return null;
    }

    const genderValues = extractGenderFilterValues(message);
    const genderColumnRef = genderValues ? getStudentGenderColumnReference(registry) : null;

    if (genderValues && !genderColumnRef) {
        return null;
    }

    const yearFilterValues = buildYearLevelFilterVariants(yearLevelLabel);
    const yearConditions = [];

    if (getColumnConfig(educationLevelTable, 'name')) {
        yearConditions.push({
            column: 'base_educationlevel.name',
            operator: 'in',
            value: yearFilterValues,
        });
    }

    if (getColumnConfig(schoolingProfileTable, 'schooling_year')) {
        yearConditions.push({
            column: 'base_schoolingprofile.schooling_year',
            operator: 'in',
            value: yearFilterValues,
        });
    }

    if (yearConditions.length === 0) {
        return null;
    }

    const conditions = [];

    if (genderValues && genderColumnRef) {
        conditions.push({
            column: genderColumnRef.column,
            operator: 'in',
            value: genderValues,
        });
    }

    conditions.push(
        yearConditions.length === 1
            ? yearConditions[0]
            : {
                logic: 'or',
                conditions: yearConditions,
            }
    );

    return {
        type: 'query',
        table: 'base_student',
        joins: [
            ...new Set([
                ...(genderColumnRef?.joins || []),
                'base_schoolingprofile',
                'base_educationlevel',
            ]),
        ].map((table) => ({ table })),
        operation: 'count',
        columns: [],
        filters: {
            logic: 'and',
            conditions,
        },
        group_by: [],
        order_by: [],
        limit: 25,
    };
}

function buildStructuredRetryRequest({ message, registry, error }) {
    const errorMessage = error instanceof Error ? error.message : '';

    if (!errorMessage.includes('Join from the approved schema')) {
        return null;
    }

    return (
        buildStudentYearLevelCountRequest(message, registry) ||
        buildTeacherQualificationCountRequest(message, registry)
    );
}

function buildStructuredOverrideRequest({ message, registry }) {
    return (
        buildTeacherQualificationCountRequest(message, registry) ||
        buildStudentYearLevelCountRequest(message, registry)
    );
}

function buildMissingQualificationSchemaMessage(message, registry) {
    if (!isTeacherQualificationCountQuestion(message)) {
        return null;
    }

    if (registry.get('base_qualification')) {
        return null;
    }

    return 'I can answer teacher qualification questions, but `base_qualification` is not currently included in this workspace schema. Add it to `chatbot_schema_registry` or `CHATBOT_ALLOWED_SCHEMA` first, then try again.';
}

function normalizeColumnReferenceName(columnRef) {
    if (!columnRef) {
        return '';
    }

    const rawValue = typeof columnRef === 'string'
        ? columnRef
        : (columnRef.outputLabel || columnRef.column || columnRef.sourceColumn || '');

    return String(rawValue).split('.').pop().toLowerCase();
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\bsch\.?\b/g, 'school')
        .replace(/\bschl\b/g, 'school')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function tokenizeSearchText(value) {
    return normalizeSearchText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean);
}

function levenshteinDistance(leftInput, rightInput) {
    const left = String(leftInput || '');
    const right = String(rightInput || '');

    if (left === right) {
        return 0;
    }

    if (!left.length) {
        return right.length;
    }

    if (!right.length) {
        return left.length;
    }

    const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        let diagonal = previousRow[0];
        previousRow[0] = leftIndex;

        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const saved = previousRow[rightIndex];
            const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

            previousRow[rightIndex] = Math.min(
                previousRow[rightIndex] + 1,
                previousRow[rightIndex - 1] + 1,
                diagonal + substitutionCost
            );
            diagonal = saved;
        }
    }

    return previousRow[right.length];
}

function getSimilarityScore(leftInput, rightInput) {
    const left = normalizeSearchText(leftInput);
    const right = normalizeSearchText(rightInput);

    if (!left || !right) {
        return 0;
    }

    if (left === right) {
        return 1;
    }

    const maxLength = Math.max(left.length, right.length);
    const distance = levenshteinDistance(left, right);
    return Math.max(0, 1 - distance / maxLength);
}

function extractSchoolMentionCandidates(message) {
    const source = String(message || '');
    const candidates = new Set();
    const schoolTermPattern = String.raw`(?:school|sch\.?|schl)`;
    const patterns = [
        new RegExp(`\\b(?:in|at|from|for)\\s+([a-z0-9][a-z0-9 '&-]*?\\b${schoolTermPattern}\\b)`, 'gi'),
        new RegExp(`\\b([a-z0-9][a-z0-9 '&-]*?\\b${schoolTermPattern}\\b)`, 'gi'),
    ];

    patterns.forEach((pattern) => {
        for (const match of source.matchAll(pattern)) {
            const candidate = match[1]?.trim();
            if (candidate) {
                candidates.add(candidate);
            }
        }
    });

    return Array.from(candidates);
}

function scoreSchoolCandidateMatch(candidate, school) {
    const normalizedCandidate = normalizeSearchText(candidate);
    const schoolName = school.name || school.school_name || '';
    const normalizedName = normalizeSearchText(schoolName);
    const normalizedCode = normalizeSearchText(school.code || '');

    if (!normalizedCandidate || (!normalizedName && !normalizedCode)) {
        return 0;
    }

    if (normalizedCandidate === normalizedName || normalizedCandidate === normalizedCode) {
        return 100;
    }

    if (
        normalizedName.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedName)
    ) {
        return 90;
    }

    const candidateTokens = tokenizeSearchText(candidate);
    const nameTokens = new Set(tokenizeSearchText(schoolName));

    if (candidateTokens.length === 0 || nameTokens.size === 0) {
        return 0;
    }

    const sharedTokenCount = candidateTokens.filter((token) => nameTokens.has(token)).length;

    if (sharedTokenCount === 0) {
        return 0;
    }

    const tokenCoverage = sharedTokenCount / candidateTokens.length;
    const beginsWithSameToken = candidateTokens[0] && nameTokens.has(candidateTokens[0]);

    return Math.round(tokenCoverage * 70) + (beginsWithSameToken ? 15 : 0);
}

async function resolveMentionedSchool({ message, supabase, schemaRegistry }) {
    const schoolTable = schemaRegistry.get('base_school');

    if (!schoolTable || !supabase) {
        return null;
    }

    const candidates = extractSchoolMentionCandidates(message);

    if (candidates.length === 0) {
        return null;
    }

    const selectColumns = ['id'];

    if (getColumnConfig(schoolTable, 'name')) {
        selectColumns.push('name');
    }

    if (getColumnConfig(schoolTable, 'school_name')) {
        selectColumns.push('school_name');
    }

    if (getColumnConfig(schoolTable, 'code')) {
        selectColumns.push('code');
    }

    const { data, error } = await supabase
        .from(schoolTable.source)
        .select(selectColumns.join(', '))
        .limit(500);

    if (error || !Array.isArray(data) || data.length === 0) {
        return null;
    }

    const rankedMatches = [];

    candidates.forEach((candidate) => {
        data.forEach((school) => {
            rankedMatches.push({
                candidate,
                score: scoreSchoolCandidateMatch(candidate, school),
                school,
            });
        });
    });

    rankedMatches.sort((left, right) => right.score - left.score);
    const bestMatch = rankedMatches[0] || null;

    if (!bestMatch) {
        return null;
    }

    if (bestMatch.score < 60) {
        const suggestions = rankedMatches
            .filter((match) => match.score >= 40)
            .reduce((uniqueMatches, match) => {
                const schoolId = match.school.id;

                if (uniqueMatches.some((entry) => entry.id === schoolId)) {
                    return uniqueMatches;
                }

                uniqueMatches.push({
                    id: schoolId,
                    name: match.school.name || match.school.school_name || schoolId,
                    code: match.school.code || null,
                });
                return uniqueMatches;
            }, [])
            .slice(0, 3);

        return suggestions.length > 0
            ? {
                status: 'suggestions',
                matchedPhrase: bestMatch.candidate,
                suggestions,
            }
            : null;
    }

    return {
        status: 'resolved',
        id: bestMatch.school.id,
        name: bestMatch.school.name || bestMatch.school.school_name || bestMatch.school.id,
        code: bestMatch.school.code || null,
        matchedPhrase: bestMatch.candidate,
    };
}

function buildSchoolSuggestionMessage(matchResult) {
    if (!matchResult || matchResult.status !== 'suggestions' || !matchResult.suggestions?.length) {
        return null;
    }

    const suggestionLabels = matchResult.suggestions.map((school) => `\"${school.name}\"`);

    if (suggestionLabels.length === 1) {
        return `I couldn't quite match \"${matchResult.matchedPhrase}\" to a school. Were you referring to ${suggestionLabels[0]}?`;
    }

    if (suggestionLabels.length === 2) {
        return `I couldn't quite match \"${matchResult.matchedPhrase}\" to a school. Were you referring to ${suggestionLabels[0]} or ${suggestionLabels[1]}?`;
    }

    return `I couldn't quite match \"${matchResult.matchedPhrase}\" to a school. Were you referring to ${suggestionLabels.slice(0, -1).join(', ')}, or ${suggestionLabels.at(-1)}?`;
}

function getPersonEntityLabel(tableName) {
    if (tableName === 'base_student') {
        return 'student';
    }

    if (tableName === 'base_teacher') {
        return 'teacher';
    }

    return null;
}

function collectNameFilterValues(filterGroup) {
    if (!filterGroup) {
        return {
            fullNames: [],
            firstNames: [],
            lastNames: [],
        };
    }

    const values = {
        fullNames: [],
        firstNames: [],
        lastNames: [],
    };

    const visit = (group) => {
        group.conditions.forEach((condition) => {
            if ('logic' in condition && 'conditions' in condition) {
                visit(condition);
                return;
            }

            const columnName = normalizeColumnReferenceName(condition.column);
            const rawValues = Array.isArray(condition.value) ? condition.value : [condition.value];
            const normalizedValues = rawValues
                .filter((value) => typeof value === 'string' && value.trim())
                .map((value) => value.trim());

            if (normalizedValues.length === 0) {
                return;
            }

            if (['student_full_name', 'teacher_full_name', 'full_name', 'name'].includes(columnName)) {
                values.fullNames.push(...normalizedValues);
            } else if (columnName === 'first_name') {
                values.firstNames.push(...normalizedValues);
            } else if (columnName === 'last_name') {
                values.lastNames.push(...normalizedValues);
            }
        });
    };

    visit(filterGroup);
    return values;
}

function extractPersonNameCandidate({ message, request, entityLabel }) {
    const nameFilterValues = collectNameFilterValues(request.filters);

    if (nameFilterValues.fullNames.length > 0) {
        return nameFilterValues.fullNames[0];
    }

    if (nameFilterValues.firstNames.length > 0 && nameFilterValues.lastNames.length > 0) {
        return `${nameFilterValues.firstNames[0]} ${nameFilterValues.lastNames[0]}`;
    }

    const source = String(message || '');
    const patterns = [
        new RegExp(`\\b${entityLabel}\\s+(?:named\\s+)?(?!in\\b|at\\b|from\\b)([a-z][a-z' -]*[a-z](?:\\s+[a-z][a-z' -]*[a-z]){1,3})(?=\\s+(?:in|at|from)\\b|[?.!,]|$)`, 'i'),
        /\bnamed\s+([a-z][a-z' -]*[a-z](?:\s+[a-z][a-z' -]*[a-z]){1,3})(?=\s+(?:in|at|from)\b|[?.!,]|$)/i,
    ];

    for (const pattern of patterns) {
        const match = source.match(pattern);
        const candidate = match?.[1]?.trim();
        if (candidate) {
            return candidate;
        }
    }

    return null;
}

function getPersonNameColumns(tableConfig) {
    return {
        fullName:
            getColumnConfig(tableConfig, 'student_full_name') ||
            getColumnConfig(tableConfig, 'teacher_full_name') ||
            getColumnConfig(tableConfig, 'full_name') ||
            getColumnConfig(tableConfig, 'name') ||
            null,
        firstName: getColumnConfig(tableConfig, 'first_name') || null,
        lastName: getColumnConfig(tableConfig, 'last_name') || null,
    };
}

function buildPersonDisplayName(row, nameColumns) {
    if (nameColumns.fullName?.name && row[nameColumns.fullName.name]) {
        return row[nameColumns.fullName.name];
    }

    const firstName = nameColumns.firstName?.name ? row[nameColumns.firstName.name] : '';
    const lastName = nameColumns.lastName?.name ? row[nameColumns.lastName.name] : '';
    return `${firstName || ''} ${lastName || ''}`.trim();
}

function scorePersonCandidateMatch(candidate, personName) {
    const normalizedCandidate = normalizeSearchText(candidate);
    const normalizedPersonName = normalizeSearchText(personName);

    if (!normalizedCandidate || !normalizedPersonName) {
        return 0;
    }

    if (normalizedCandidate === normalizedPersonName) {
        return 100;
    }

    if (
        normalizedPersonName.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedPersonName)
    ) {
        return 90;
    }

    const similarityScore = getSimilarityScore(normalizedCandidate, normalizedPersonName);
    const candidateTokens = tokenizeSearchText(candidate);
    const personTokens = tokenizeSearchText(personName);
    const firstTokenSimilarity = candidateTokens[0] && personTokens[0]
        ? getSimilarityScore(candidateTokens[0], personTokens[0])
        : 0;

    return Math.round((similarityScore * 70) + (firstTokenSimilarity * 20));
}

async function resolveMentionedPerson({
    message,
    request,
    supabase,
    schemaRegistry,
    resolvedSchool,
}) {
    const entityLabel = getPersonEntityLabel(request.table);

    if (!entityLabel) {
        return null;
    }

    const candidate = extractPersonNameCandidate({
        message,
        request,
        entityLabel,
    });

    if (!candidate) {
        return null;
    }

    if (!resolvedSchool || resolvedSchool.status !== 'resolved') {
        return {
            status: 'needs_school',
            entityLabel,
            matchedPhrase: candidate,
        };
    }

    const tableConfig = schemaRegistry.get(request.table);
    const schoolIdentifierColumn = tableConfig
        ? findBaseSchoolIdentifierColumn(tableConfig)
        : null;
    const nameColumns = tableConfig ? getPersonNameColumns(tableConfig) : null;

    if (!tableConfig || !schoolIdentifierColumn || !nameColumns) {
        return null;
    }

    const selectColumns = ['id', schoolIdentifierColumn.name];
    [nameColumns.fullName, nameColumns.firstName, nameColumns.lastName]
        .filter(Boolean)
        .forEach((column) => {
            if (!selectColumns.includes(column.name)) {
                selectColumns.push(column.name);
            }
        });

    const { data, error } = await supabase
        .from(tableConfig.source)
        .select(selectColumns.join(', '))
        .eq(schoolIdentifierColumn.name, resolvedSchool.id)
        .limit(500);

    if (error || !Array.isArray(data) || data.length === 0) {
        return null;
    }

    const rankedMatches = data
        .map((row) => ({
            row,
            displayName: buildPersonDisplayName(row, nameColumns),
        }))
        .filter((entry) => entry.displayName)
        .map((entry) => ({
            ...entry,
            score: scorePersonCandidateMatch(candidate, entry.displayName),
        }))
        .sort((left, right) => right.score - left.score);

    if (rankedMatches.length === 0) {
        return null;
    }

    const normalizedCandidate = normalizeSearchText(candidate);
    const exactNameMatches = rankedMatches.filter(
        (match) => normalizeSearchText(match.displayName) === normalizedCandidate
    );

    if (exactNameMatches.length > 1) {
        return {
            status: 'ambiguous',
            entityLabel,
            matchedPhrase: candidate,
            schoolName: resolvedSchool.name,
            suggestions: exactNameMatches.slice(0, 3).map((match) => ({
                id: match.row.id,
                name: match.displayName,
            })),
        };
    }

    const bestMatch = rankedMatches[0];

    if (bestMatch.score < 70) {
        const suggestions = rankedMatches
            .filter((match) => match.score >= 45)
            .reduce((uniqueMatches, match) => {
                const label = normalizeSearchText(match.displayName);

                if (uniqueMatches.some((entry) => normalizeSearchText(entry.name) === label)) {
                    return uniqueMatches;
                }

                uniqueMatches.push({
                    id: match.row.id,
                    name: match.displayName,
                });
                return uniqueMatches;
            }, [])
            .slice(0, 3);

        return suggestions.length > 0
            ? {
                status: 'suggestions',
                entityLabel,
                matchedPhrase: candidate,
                schoolName: resolvedSchool.name,
                suggestions,
            }
            : {
                status: 'needs_clarification',
                entityLabel,
                matchedPhrase: candidate,
                schoolName: resolvedSchool.name,
            };
    }

    return {
        status: 'resolved',
        entityLabel,
        table: request.table,
        matchedPhrase: candidate,
        schoolName: resolvedSchool.name,
        id: bestMatch.row.id,
        name: bestMatch.displayName,
        row: bestMatch.row,
    };
}

function buildPersonSuggestionMessage(matchResult) {
    if (!matchResult) {
        return null;
    }

    if (matchResult.status === 'needs_school') {
        return `I can help find \"${matchResult.matchedPhrase}\", but I’ll need the school name first so I can narrow down the right ${matchResult.entityLabel}.`;
    }

    if (matchResult.status === 'ambiguous') {
        return `I found more than one ${matchResult.entityLabel} named \"${matchResult.matchedPhrase}\" in \"${matchResult.schoolName}\". If you give me one more detail, like admission number, class, or gender, I can narrow it down.`;
    }

    if (matchResult.status === 'needs_clarification') {
        return `I'm not fully sure which ${matchResult.entityLabel} you mean in \"${matchResult.schoolName}\". Try checking the spelling or adding one more detail and I’ll take another look.`;
    }

    if (matchResult.status !== 'suggestions' || !matchResult.suggestions?.length) {
        return null;
    }

    const suggestionLabels = matchResult.suggestions.map((person) => `\"${person.name}\"`);

    if (suggestionLabels.length === 1) {
        return `I couldn't quite match the ${matchResult.entityLabel} \"${matchResult.matchedPhrase}\" in \"${matchResult.schoolName}\". Were you looking for ${suggestionLabels[0]}?`;
    }

    if (suggestionLabels.length === 2) {
        return `I couldn't quite match the ${matchResult.entityLabel} \"${matchResult.matchedPhrase}\" in \"${matchResult.schoolName}\". Were you looking for ${suggestionLabels[0]} or ${suggestionLabels[1]}?`;
    }

    return `I couldn't quite match the ${matchResult.entityLabel} \"${matchResult.matchedPhrase}\" in \"${matchResult.schoolName}\". Were you looking for ${suggestionLabels.slice(0, -1).join(', ')}, or ${suggestionLabels.at(-1)}?`;
}

function buildColumnRefForRequest({ request, tableName, columnConfig }) {
    const joinedTableCount = request.type === 'query' && request.joinedTables
        ? request.joinedTables.size
        : 1;
    const shouldQualify = joinedTableCount > 1;

    return {
        kind: 'column',
        table: tableName,
        source: tableName === request.table
            ? request.source
            : request.joinedTables?.get(tableName)?.source || tableName,
        sourceColumn: columnConfig.name,
        column: columnConfig.normalizedName,
        outputLabel: shouldQualify
            ? `${tableName}.${columnConfig.normalizedName}`
            : columnConfig.normalizedName,
        outputAlias: `${tableName}__${columnConfig.normalizedName}`,
    };
}

function mapSchoolConditionValue(condition, resolvedSchool) {
    const targetTable = condition.column?.table;
    const targetColumn = normalizeColumnReferenceName(condition.column);

    if (targetTable === 'base_school') {
        if (targetColumn === 'id') {
            return resolvedSchool.id;
        }

        if (targetColumn === 'code') {
            return resolvedSchool.code || resolvedSchool.id;
        }

        if (targetColumn === 'name' || targetColumn === 'school_name') {
            return resolvedSchool.name;
        }
    }

    if (targetColumn === 'school_id' || targetColumn === 'school_name_id') {
        return resolvedSchool.id;
    }

    return null;
}

function mapPersonConditionValue(condition, resolvedPerson) {
    const targetTable = condition.column?.table;
    const targetColumn = normalizeColumnReferenceName(condition.column);

    if (targetTable !== resolvedPerson.table) {
        return null;
    }

    if (targetColumn === 'id') {
        return resolvedPerson.id;
    }

    if (targetColumn === 'student_full_name' || targetColumn === 'teacher_full_name' || targetColumn === 'full_name' || targetColumn === 'name') {
        return resolvedPerson.name;
    }

    if (targetColumn === 'first_name' && resolvedPerson.row?.first_name) {
        return resolvedPerson.row.first_name;
    }

    if (targetColumn === 'last_name' && resolvedPerson.row?.last_name) {
        return resolvedPerson.row.last_name;
    }

    return null;
}

function rewriteSchoolFilters(filterGroup, resolvedSchool) {
    if (!filterGroup) {
        return { filterGroup: null, updated: false };
    }

    let updated = false;

    const nextConditions = filterGroup.conditions.map((condition) => {
        if ('logic' in condition && 'conditions' in condition) {
            const nested = rewriteSchoolFilters(condition, resolvedSchool);
            updated = updated || nested.updated;
            return nested.filterGroup;
        }

        const nextValue = mapSchoolConditionValue(condition, resolvedSchool);

        if (nextValue == null) {
            return condition;
        }

        updated = true;
        return {
            ...condition,
            value: condition.operator === 'in' ? [nextValue] : nextValue,
        };
    }).filter(Boolean);

    return {
        filterGroup: {
            ...filterGroup,
            conditions: nextConditions,
        },
        updated,
    };
}

function rewritePersonFilters(filterGroup, resolvedPerson) {
    if (!filterGroup) {
        return { filterGroup: null, updated: false };
    }

    let updated = false;

    const nextConditions = filterGroup.conditions.map((condition) => {
        if ('logic' in condition && 'conditions' in condition) {
            const nested = rewritePersonFilters(condition, resolvedPerson);
            updated = updated || nested.updated;
            return nested.filterGroup;
        }

        const nextValue = mapPersonConditionValue(condition, resolvedPerson);

        if (nextValue == null) {
            return condition;
        }

        updated = true;
        return {
            ...condition,
            value: condition.operator === 'in' ? [nextValue] : nextValue,
        };
    }).filter(Boolean);

    return {
        filterGroup: {
            ...filterGroup,
            conditions: nextConditions,
        },
        updated,
    };
}

function appendAndFilter(filterGroup, condition) {
    if (!filterGroup) {
        return {
            logic: 'and',
            conditions: [condition],
        };
    }

    if (filterGroup.logic === 'and') {
        return {
            ...filterGroup,
            conditions: [...filterGroup.conditions, condition],
        };
    }

    return {
        logic: 'and',
        conditions: [filterGroup, condition],
    };
}

function findBaseSchoolIdentifierColumn(tableConfig) {
    return (
        getColumnConfig(tableConfig, 'school_name_id') ||
        getColumnConfig(tableConfig, 'school_id') ||
        null
    );
}

function applyResolvedSchoolFilter(request, resolvedSchool, schemaRegistry) {
    if (!resolvedSchool || resolvedSchool.status !== 'resolved') {
        return request;
    }

    const rewrittenFilters = rewriteSchoolFilters(request.filters, resolvedSchool);

    if (rewrittenFilters.updated) {
        return {
            ...request,
            filters: rewrittenFilters.filterGroup,
        };
    }

    const baseTableConfig = schemaRegistry.get(request.table);

    if (!baseTableConfig) {
        return request;
    }

    if (request.table === 'base_school') {
        const schoolIdColumn = getColumnConfig(baseTableConfig, 'id');

        if (!schoolIdColumn) {
            return request;
        }

        return {
            ...request,
            filters: appendAndFilter(
                request.filters,
                {
                    type: 'condition',
                    column: buildColumnRefForRequest({
                        request,
                        tableName: request.table,
                        columnConfig: schoolIdColumn,
                    }),
                    operator: '=',
                    value: resolvedSchool.id,
                }
            ),
        };
    }

    const schoolIdentifierColumn = findBaseSchoolIdentifierColumn(baseTableConfig);

    if (!schoolIdentifierColumn) {
        return request;
    }

    return {
        ...request,
        filters: appendAndFilter(
            request.filters,
            {
                type: 'condition',
                column: buildColumnRefForRequest({
                    request,
                    tableName: request.table,
                    columnConfig: schoolIdentifierColumn,
                }),
                operator: '=',
                value: resolvedSchool.id,
            }
        ),
    };
}

function applyResolvedPersonFilter(request, resolvedPerson, schemaRegistry) {
    if (!resolvedPerson || resolvedPerson.status !== 'resolved') {
        return request;
    }

    const rewrittenFilters = rewritePersonFilters(request.filters, resolvedPerson);

    if (rewrittenFilters.updated) {
        return {
            ...request,
            filters: rewrittenFilters.filterGroup,
        };
    }

    const tableConfig = schemaRegistry.get(request.table);

    if (!tableConfig) {
        return request;
    }

    const idColumn = getColumnConfig(tableConfig, 'id');

    if (!idColumn) {
        return request;
    }

    return {
        ...request,
        filters: appendAndFilter(
            request.filters,
            {
                type: 'condition',
                column: buildColumnRefForRequest({
                    request,
                    tableName: request.table,
                    columnConfig: idColumn,
                }),
                operator: '=',
                value: resolvedPerson.id,
            }
        ),
    };
}

function requestIncludesGenderDimension(request) {
    if (!request) {
        return false;
    }

    const filterColumns = [];
    const collectFilterColumns = (filterGroup) => {
        if (!filterGroup?.conditions) {
            return;
        }

        filterGroup.conditions.forEach((condition) => {
            if ('logic' in condition && 'conditions' in condition) {
                collectFilterColumns(condition);
                return;
            }

            filterColumns.push(condition.column);
        });
    };

    collectFilterColumns(request.filters);

    if (request.type === 'query') {
        return [
            ...(request.group_by || []),
            ...(request.columns || []),
            ...(request.order_by || []).map((order) => order.column),
            ...filterColumns,
        ].some((columnRef) => ['gender', 'sex'].includes(normalizeColumnReferenceName(columnRef)));
    }

    return [
        request.column,
        request.group_by,
        request.second_column,
        ...filterColumns,
    ].some((columnRef) => ['gender', 'sex'].includes(normalizeColumnReferenceName(columnRef)));
}

function requestSchemaSupportsGenderDimension(request, schemaRegistry) {
    if (!request) {
        return false;
    }

    const tableNames = request.type === 'query'
        ? [request.table, ...(request.joins || []).map((join) => join.table)]
        : [request.table];

    return tableNames.some((tableName) => {
        const tableConfig = schemaRegistry.get(tableName);
        return tableConfig?.columns?.some((column) => ['gender', 'sex'].includes(column.normalizedName));
    });
}

function shouldConvertAnalysisToCountQuery(request) {
    if (!request || request.type !== 'analysis') {
        return false;
    }

    if (!request.group_by) {
        return false;
    }

    if (!['comparison', 'trend', 'composition', 'period_change'].includes(request.analysis)) {
        return false;
    }

    const metricColumn = request.column || '';
    return metricColumn === 'id' || metricColumn.endsWith('_id');
}

function convertAnalysisToCountQuery(request, schemaRegistry) {
    const tableConfig = schemaRegistry.get(request.table);

    if (!tableConfig) {
        throw new Error(`Unsupported table "${request.table}".`);
    }

    const joinedTables = new Map([[request.table, tableConfig]]);
    const groupColumn = {
        kind: 'column',
        table: request.table,
        source: request.source,
        sourceColumn: request.group_by,
        column: request.group_by,
        outputLabel: request.group_by,
        outputAlias: `${request.table}__${request.group_by}`,
    };

    return {
        type: 'query',
        table: request.table,
        operation: 'count',
        provider: request.provider,
        source: request.source,
        joins: [],
        joinedTables,
        columns: [],
        filters: request.filters,
        group_by: [groupColumn],
        order_by: [
            {
                column: {
                    kind: 'aggregate',
                    outputLabel: 'value',
                    outputAlias: 'value',
                    table: null,
                    column: 'value',
                },
                direction: 'desc',
            },
        ],
        limit: Number(process.env.CHATBOT_QUERY_ROW_LIMIT || 100),
    };
}

function buildStructuredValidationFallbackMessage(message, error) {
    const normalizedMessage = (message || '').trim().toLowerCase();
    const errorMessage = error instanceof Error ? error.message : '';

    if (
        errorMessage.includes('Join from the approved schema') &&
        /\bschool\b|\bschools\b/.test(normalizedMessage) &&
        /\btotal\b|\bnumber\b|\bcount\b/.test(normalizedMessage)
    ) {
        return 'I can help with school data, but that request is ambiguous about what should be counted. Try one of these instead: "list all schools", "count total schools", "number of students by school", or "number of teachers by school".';
    }

    if (errorMessage.includes('Join from the approved schema')) {
        return 'I found a relevant dataset, but the requested join is not available in the approved schema for this workspace. Please rephrase with a more specific table target, or ask for a simpler breakdown.';
    }

    return null;
}

export async function handleStructuredChat({
    message,
    history,
    dataContext,
    supabase,
    registrySupabase = null,
    aiConfig,
}) {
    // Schema can come from the Supabase registry, .env fallback, or selected
    // file context. The controller does not care which source won.
    const schemaRegistry = await buildSchemaRegistry({
        dataContext,
        supabase,
        registrySupabase,
        skipCache: true,
    });

    if (schemaRegistry.size === 0) {
        const { message: responseText, usage } = await generateGeneralChatResponse({
            question: message,
            history,
            registry: schemaRegistry,
            aiConfig,
        });

        return buildGeneralResponse(responseText, usage);
    }

    if (isClearlyGeneralConversation(message) || isLikelyExternalWorldQuestion(message)) {
        const { message: responseText, usage } = await generateGeneralChatResponse({
            question: message,
            history,
            registry: schemaRegistry,
            aiConfig,
        });

        return buildGeneralResponse(responseText, usage);
    }
    const shouldPreferStructured = Boolean(dataContext) || isLikelyAnalyticsQuestion(message, schemaRegistry);
    const includeDebug = shouldIncludeDebugPayload(message);
    let validatedRequest = null;
    let planningUsage = {};
    const missingQualificationSchemaMessage = buildMissingQualificationSchemaMessage(message, schemaRegistry);

    if (missingQualificationSchemaMessage) {
        return buildGeneralResponse(missingQualificationSchemaMessage, planningUsage);
    }

    try {
        const { request: aiPayload, usage } = await planStructuredRequest({
            question: message,
            history,
            registry: schemaRegistry,
            aiConfig,
        });
        planningUsage = usage;

        // The planner can only suggest a request. Validation is the security gate
        // that enforces the approved schema and allowed operations.
        validatedRequest = validateStructuredRequest(aiPayload, schemaRegistry);

        const overridePayload = buildStructuredOverrideRequest({
            message,
            registry: schemaRegistry,
        });

        if (overridePayload) {
            validatedRequest = validateStructuredRequest(overridePayload, schemaRegistry);
        }
    } catch (error) {
        const retryPayload = buildStructuredRetryRequest({
            message,
            registry: schemaRegistry,
            error,
        });

        if (retryPayload) {
            try {
                validatedRequest = validateStructuredRequest(retryPayload, schemaRegistry);
            } catch {
                validatedRequest = null;
            }
        }

        if (validatedRequest) {
            // Continue with the repaired request below.
        } else {
            const fallbackMessage = buildStructuredValidationFallbackMessage(message, error);

            if (fallbackMessage) {
                return buildGeneralResponse(fallbackMessage, planningUsage);
            }

            if (shouldPreferStructured) {
                throw error;
            }

            const { message: responseText, usage } = await generateGeneralChatResponse({
                question: message,
                history,
                registry: schemaRegistry,
                aiConfig,
            });

            return buildGeneralResponse(responseText, usage);
        }
    }

    if (isGenderBreakdownQuestion(message) && !requestIncludesGenderDimension(validatedRequest)) {
        if (!requestSchemaSupportsGenderDimension(validatedRequest, schemaRegistry)) {
            return buildGeneralResponse(
                'I can show totals for that teacher breakdown, but I cannot split it into male and female counts because the approved schema for this workspace does not expose a gender field for that dataset.',
                planningUsage
            );
        }

        return buildGeneralResponse(
            'I found the right dataset, but the generated request dropped the gender breakdown. Please try the question again, or ask for counts grouped by school and gender.',
            planningUsage
        );
    }

    const schoolMatchResult = await resolveMentionedSchool({
        message,
        supabase,
        schemaRegistry,
    });

    if (schoolMatchResult?.status === 'suggestions') {
        return buildGeneralResponse(
            buildSchoolSuggestionMessage(schoolMatchResult),
            planningUsage
        );
    }

    validatedRequest = applyResolvedSchoolFilter(validatedRequest, schoolMatchResult, schemaRegistry);
    const personMatchResult = await resolveMentionedPerson({
        message,
        request: validatedRequest,
        supabase,
        schemaRegistry,
        resolvedSchool: schoolMatchResult,
    });

    if (
        personMatchResult?.status === 'needs_school' ||
        personMatchResult?.status === 'suggestions' ||
        personMatchResult?.status === 'ambiguous' ||
        personMatchResult?.status === 'needs_clarification'
    ) {
        return buildGeneralResponse(
            buildPersonSuggestionMessage(personMatchResult),
            planningUsage
        );
    }

    validatedRequest = applyResolvedPersonFilter(validatedRequest, personMatchResult, schemaRegistry);

    if (validatedRequest.type === 'query') {
        // Query requests stay inside Node and return tabular/aggregate data.
        const plan = buildQueryPlan(validatedRequest);
        const result = await executeQueryPlan({ plan, supabase });

        return {
            structuredRequest: validatedRequest,
            ...formatQueryResponse({
                request: validatedRequest,
                result,
                plan,
                includeDebug,
            }),
            tokenUsage: planningUsage,
            generatedSql: plan.sql || null,
            generatedJson: validatedRequest,
        };
    }

    if (shouldConvertAnalysisToCountQuery(validatedRequest)) {
        const countQueryRequest = convertAnalysisToCountQuery(validatedRequest, schemaRegistry);
        const countPlan = buildQueryPlan(countQueryRequest);
        const countResult = await executeQueryPlan({ plan: countPlan, supabase });

        return {
            structuredRequest: countQueryRequest,
            ...formatQueryResponse({
                request: countQueryRequest,
                result: countResult,
                plan: countPlan,
                includeDebug,
            }),
            tokenUsage: planningUsage,
            generatedSql: countPlan.sql || null,
            generatedJson: countQueryRequest,
        };
    }

    const analysisTable = schemaRegistry.get(validatedRequest.table);
    const analysisColumns = validatedRequest.analysis === 'data_quality' && !validatedRequest.column
        ? analysisTable.columns.map((column) => ({
            kind: 'column',
            table: validatedRequest.table,
            source: validatedRequest.source,
            column: column.normalizedName,
            outputLabel: column.normalizedName,
            outputAlias: `${validatedRequest.table}__${column.normalizedName}`,
        }))
        : [
            ...(validatedRequest.group_by
                ? [{
                    kind: 'column',
                    table: validatedRequest.table,
                    source: validatedRequest.source,
                    column: validatedRequest.group_by,
                    outputLabel: validatedRequest.group_by,
                    outputAlias: `${validatedRequest.table}__${validatedRequest.group_by}`,
                }]
                : []),
            ...(validatedRequest.column
                ? [{
                    kind: 'column',
                    table: validatedRequest.table,
                    source: validatedRequest.source,
                    column: validatedRequest.column,
                    outputLabel: validatedRequest.column,
                    outputAlias: `${validatedRequest.table}__${validatedRequest.column}`,
                }]
                : []),
            ...(validatedRequest.second_column
                ? [{
                    kind: 'column',
                    table: validatedRequest.table,
                    source: validatedRequest.source,
                    column: validatedRequest.second_column,
                    outputLabel: validatedRequest.second_column,
                    outputAlias: `${validatedRequest.table}__${validatedRequest.second_column}`,
                }]
                : []),
        ];
    // Analysis requests first fetch raw rows through the same safe query layer,
    // then hand the reduced dataset to Python/pandas.
    const analysisPlan = buildQueryPlan({
        type: 'query',
        table: validatedRequest.table,
        operation: 'select',
        provider: validatedRequest.provider,
        source: validatedRequest.source,
        joins: [],
        joinedTables: new Map([[validatedRequest.table, analysisTable]]),
        columns: analysisColumns,
        filters: validatedRequest.filters,
        group_by: [],
        order_by: [],
        limit: Number(process.env.CHATBOT_QUERY_ROW_LIMIT || 100),
    });

    const rawData = await executeQueryPlan({
        plan: analysisPlan,
        supabase,
    });

    const result = await runPythonAnalysis({
        request: {
            analysis: validatedRequest.analysis,
            table: validatedRequest.table,
            column: validatedRequest.column,
            second_column: validatedRequest.second_column,
            group_by: validatedRequest.group_by,
        },
        rows: rawData.rows || [],
    });

    return {
        structuredRequest: validatedRequest,
        ...formatAnalysisResponse({
            request: validatedRequest,
            result,
            plan: analysisPlan,
            includeDebug,
        }),
        tokenUsage: planningUsage,
        generatedSql: analysisPlan.sql || null,
        generatedJson: validatedRequest,
    };
}
