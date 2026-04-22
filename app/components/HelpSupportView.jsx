'use client';
import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, MessageCircle, Mail, FileText, ExternalLink } from 'lucide-react';

const HelpSupportView = () => {
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    const faqs = [
        {
            question: "How do I upload my own data?",
            answer: "You can upload data by navigating to the 'Data Sources' tab in the sidebar. Click on the 'Upload' button and select your CSV or Excel file. Supported formats include .csv, .xlsx, and .json."
        },
        {
            question: "Is my data secure?",
            answer: "Yes, we take security seriously. All data is encrypted at rest and in transit. We are fully compliant with SOC2 and GDPR standards. Your data is never shared with third parties without your explicit consent."
        },
        {
            question: "Can I export the analysis results?",
            answer: "Absolutely. Once the AI has generated an analysis or a chart, you can click the 'Export' icon in the top right corner of the message to download it as a PDF or image file."
        },
        {
            question: "How do I reset a chat session?",
            answer: "To start fresh, simply click the 'New Chat' button in the sidebar. This will clear the current context and allow you to begin a new analysis session."
        }
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8 animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-12">

                {/* Header Section */}
                <div className="text-center space-y-4">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">How can we help you?</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                        Search our knowledge base or get in touch with our support team.
                    </p>
                    <div className="relative max-w-lg mx-auto mt-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search for answers..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm"
                        />
                    </div>
                </div>

                {/* Quick Links / Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit text-blue-600 dark:text-blue-400 mb-4">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Documentation</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                            Detailed guides and API references to help you get the most out of our platform.
                        </p>
                        <span className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center group">
                            Read Docs <ExternalLink size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg w-fit text-green-600 dark:text-green-400 mb-4">
                            <MessageCircle size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Community Forum</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                            Join the conversation, share tips, and get answers from other users.
                        </p>
                        <span className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center group">
                            Visit Forum <ExternalLink size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit text-purple-600 dark:text-purple-400 mb-4">
                            <Mail size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Contact Support</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                            Need personalized help? Our support team is available 24/7 to assist you.
                        </p>
                        <span className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center group">
                            Contact Us <ExternalLink size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                    </div>
                </div>

                {/* FAQs Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {faqs.map((faq, index) => (
                            <div key={index} className="p-6">
                                <button
                                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                                    className="w-full flex items-center justify-between text-left focus:outline-none group"
                                >
                                    <span className="text-base font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {faq.question}
                                    </span>
                                    {openFaqIndex === index ? (
                                        <ChevronUp className="text-gray-400" size={20} />
                                    ) : (
                                        <ChevronDown className="text-gray-400" size={20} />
                                    )}
                                </button>
                                {openFaqIndex === index && (
                                    <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm leading-relaxed animate-fade-in">
                                        {faq.answer}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Note */}
                <div className="text-center pb-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Still can't find what you're looking for? <a href="#" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Submit a ticket</a>
                    </p>
                </div>

            </div>
        </div>
    );
};

export default HelpSupportView;
