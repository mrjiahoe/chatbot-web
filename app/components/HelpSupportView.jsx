'use client';

import React, { useMemo, useState } from 'react';
import {
    ChevronDown,
    ExternalLink,
    FileText,
    Mail,
    MessageCircle,
    Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';

const faqs = [
    {
        id: 'upload-data',
        question: 'How do I upload my own data?',
        answer:
            "Open the Data Sources tab in the sidebar, then use the Upload button to add a CSV, Excel, or JSON file.",
    },
    {
        id: 'security',
        question: 'Is my data secure?',
        answer:
            'Yes. Data is encrypted in transit and at rest, and your workspace is only accessible to your account.',
    },
    {
        id: 'export-results',
        question: 'Can I export the analysis results?',
        answer:
            'Yes. Use the export controls on a result to download it as a file or image, depending on the output type.',
    },
    {
        id: 'reset-chat',
        question: 'How do I reset a chat session?',
        answer:
            "Click New Chat in the sidebar to clear the current context and start a fresh conversation.",
    },
];

const supportCards = [
    {
        icon: FileText,
        title: 'Documentation',
        description: 'Browse step-by-step guides and references for common tasks.',
        accent: 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
        action: 'Read docs',
    },
    {
        icon: MessageCircle,
        title: 'Community Forum',
        description: 'See how other users approach similar workflows and questions.',
        accent: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
        action: 'Visit forum',
    },
    {
        icon: Mail,
        title: 'Contact Support',
        description: 'Reach out when you need a more hands-on answer or account help.',
        accent: 'bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
        action: 'Send message',
    },
];

const HelpSupportView = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [openFaqId, setOpenFaqId] = useState(null);

    const filteredFaqs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return faqs;
        }

        return faqs.filter((faq) => {
            const question = faq.question.toLowerCase();
            const answer = faq.answer.toLowerCase();
            return question.includes(query) || answer.includes(query);
        });
    }, [searchQuery]);

    return (
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Support
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                        How can we help you?
                    </h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        Search help articles, open documentation, or browse the most common questions below.
                    </p>
                </div>

                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border bg-muted/20">
                        <CardTitle>Search help</CardTitle>
                        <CardDescription>
                            Type a keyword to narrow the FAQ list and find the answer faster.
                        </CardDescription>
                        <div className="relative max-w-xl pt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for answers..."
                                className="pl-9"
                            />
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid gap-4 md:grid-cols-3">
                    {supportCards.map((card) => {
                        const Icon = card.icon;

                        return (
                            <Card key={card.title} className="group transition-shadow hover:shadow-md">
                                <CardHeader>
                                    <div className={`mb-2 flex size-12 items-center justify-center rounded-xl ${card.accent}`}>
                                        <Icon className="size-5" />
                                    </div>
                                    <CardTitle>{card.title}</CardTitle>
                                    <CardDescription>{card.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button variant="outline" className="w-full justify-between">
                                        {card.action}
                                        <ExternalLink className="size-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border bg-muted/20">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <CardTitle>Frequently Asked Questions</CardTitle>
                                <CardDescription>
                                    {filteredFaqs.length} result{filteredFaqs.length === 1 ? '' : 's'} shown.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-3 p-4 md:p-6">
                        {filteredFaqs.length ? (
                            filteredFaqs.map((faq) => {
                                const open = openFaqId === faq.id;

                                return (
                                    <Collapsible
                                        key={faq.id}
                                        open={open}
                                        onOpenChange={(nextOpen) => setOpenFaqId(nextOpen ? faq.id : null)}
                                    >
                                        <div className="rounded-xl border border-border bg-background shadow-sm">
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="flex h-auto w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-muted/40"
                                                >
                                                    <span className="text-sm font-medium text-foreground">
                                                        {faq.question}
                                                    </span>
                                                    <ChevronDown
                                                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                                                            open ? 'rotate-180' : ''
                                                        }`}
                                                    />
                                                </Button>
                                            </CollapsibleTrigger>

                                            <CollapsibleContent className="px-4 pb-4">
                                                <p className="text-sm leading-6 text-muted-foreground">
                                                    {faq.answer}
                                                </p>
                                            </CollapsibleContent>
                                        </div>
                                    </Collapsible>
                                );
                            })
                        ) : (
                            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
                                <p className="text-base font-semibold text-foreground">No FAQ matches found</p>
                                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                    Try a different search term or clear the search box to see all questions again.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center pb-4">
                    <p className="text-sm text-muted-foreground">
                        Still need help?{' '}
                        <button type="button" className="font-medium text-primary hover:underline">
                            Submit a ticket
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HelpSupportView;
