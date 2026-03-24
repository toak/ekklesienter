import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, CheckCircle2, History, Heart, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface ChangelogEntry {
    version: string;
    title: string;
    date: string;
    description: string;
    features: string[];
}

const AboutSettings: React.FC = () => {
    const { t } = useTranslation();

    const changelogEntries = t('changelog_entries', { returnObjects: true }) as unknown as ChangelogEntry[];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">

            {/* Hero Section — Premium Glassmorphism */}
            <div className="bg-stone-900/40 border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden group shadow-2xl">
                {/* Dynamic Aura Background */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-accent/10 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3 group-hover:bg-accent/20 transition-all duration-1000" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-all duration-1000" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="relative mb-10 group/icon">
                        <div className="absolute inset-0 bg-accent/30 blur-3xl rounded-full opacity-0 group-hover/icon:opacity-100 transition-opacity duration-700" />
                        <div className="relative w-28 h-28 rounded-4xl bg-stone-950 border border-white/10 flex items-center justify-center shadow-inner-white transition-all duration-700 group-hover/icon:scale-110 group-hover/icon:rotate-6">
                            <Sparkles className="w-14 h-14 text-accent drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]" />
                        </div>
                    </div>

                    <h1 className="text-5xl font-black tracking-tighter mb-4 leading-none bg-linear-to-r from-white via-stone-200 to-stone-500 bg-clip-text text-transparent">
                        {t('app_title')}
                    </h1>

                    <div className="flex items-center gap-3 px-6 py-2.5 bg-accent/10 border border-accent/20 rounded-full shadow-lg shadow-accent/5 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
                        <span className="text-xs font-black text-accent tracking-[0.25em] uppercase">
                            {changelogEntries?.[0]?.version} {changelogEntries?.[0]?.title}
                        </span>
                    </div>

                    <p className="mt-8 max-w-xl text-base text-stone-400 font-medium leading-relaxed italic opacity-90 indent-4">
                        {changelogEntries?.[0]?.description}
                    </p>
                </div>
            </div>

            {/* Versioned Changelog Timeline */}
            <div className="relative px-4">
                {/* Timeline Axis */}
                <div className="absolute left-[34px] top-8 bottom-8 w-px bg-linear-to-b from-accent/50 via-stone-800 to-transparent" />

                <div className="space-y-16">
                    {Array.isArray(changelogEntries) && changelogEntries.map((entry, idx) => (
                        <div
                            key={entry.version}
                            className={cn(
                                "relative pl-16 animate-in fade-in slide-in-from-left-4 duration-700",
                                idx === 0 ? "delay-100" : idx === 1 ? "delay-300" : "delay-500"
                            )}
                        >
                            {/* Version Indicator Dot */}
                            <div className="absolute left-0 top-1 w-9 h-9 rounded-xl bg-stone-950 border border-white/10 flex items-center justify-center shadow-xl z-10 group/dot hover:border-accent/40 transition-colors">
                                <div className="w-2.5 h-2.5 rounded-full bg-stone-700 group-hover/dot:bg-accent transition-all duration-300 group-hover/dot:scale-125" />
                            </div>

                            <div className="space-y-6">
                                {/* Date & Version Label */}
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-stone-900/60 border border-white/5 rounded-lg">
                                        <Calendar className="w-3 h-3 text-stone-500" />
                                        <span className="text-[10px] text-stone-400 font-black uppercase tracking-widest">{entry.date}</span>
                                    </div>
                                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                                        {entry.version}
                                        <ArrowRight className="w-4 h-4 text-stone-700" />
                                        <span className="text-stone-400">{entry.title}</span>
                                    </h2>
                                </div>

                                {/* Features Bento Card */}
                                <div className="bg-stone-900/30 border border-white/5 rounded-3xl p-6 hover:bg-white/5 transition-all duration-500 group/card">
                                    <p className="text-sm text-stone-400 font-medium mb-6 leading-relaxed">
                                        {entry.description}
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {entry.features.map((feature, fIdx) => (
                                            <div
                                                key={fIdx}
                                                className="flex items-start gap-3 p-3 bg-stone-950/40 rounded-xl border border-transparent group-hover/card:border-white/5 transition-all duration-300 hover:bg-accent/5 hover:-translate-y-1"
                                            >
                                                <div className="mt-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-accent opacity-40 group-hover/card:opacity-100 transition-all" />
                                                </div>
                                                <span className="text-xs text-stone-300 font-medium leading-tight group-hover/card:text-stone-200 transition-colors">
                                                    {feature}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Premium Footer */}
            <div className="flex flex-col items-center gap-6 py-12 relative">
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="h-px w-12 bg-linear-to-r from-transparent to-stone-800 transition-all duration-700 group-hover:w-20" />
                    <div className="p-3 rounded-full bg-stone-900/50 border border-white/5 group-hover:border-rose-500/20 group-hover:bg-rose-500/5 transition-all duration-700">
                        <Heart className="w-4 h-4 text-stone-700 group-hover:text-rose-500 fill-transparent group-hover:fill-rose-500 animate-pulse" />
                    </div>
                    <div className="h-px w-12 bg-linear-to-l from-transparent to-stone-800 transition-all duration-700 group-hover:w-20" />
                </div>

                <div className="text-center space-y-2">
                    <p className="text-[11px] text-stone-500 font-black uppercase tracking-[0.4em] hover:text-stone-300 transition-colors duration-700">
                        {t('crafted_with_passion')}
                    </p>
                    <div className="flex items-center justify-center gap-4 text-[9px] text-stone-800 font-medium uppercase tracking-[0.2em]">
                        <span>Ekklesienter</span>
                        <span className="w-1 h-1 rounded-full bg-stone-900" />
                        <span>Soli Deo Gloria</span>
                        <span className="w-1 h-1 rounded-full bg-stone-900" />
                        <span>{new Date().getFullYear()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutSettings;
