"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button.jsx";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Sparkles,
    ArrowRight,
    Mic,
    ShieldCheck,
    Globe,
    Save,
    CheckCircle,
} from "lucide-react";
import useNavigationStore from '@/store/useNavigationStore';
import useLocalizationStore, { useTranslation } from '@/store/useLocalizationStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LanguageLoadingOverlay from '@/components/LanguageLoadingOverlay';

export default function LandingPage() {
    const { status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            router.push("/onboarding");
        }
    }, [status, router]);

    const language = useNavigationStore((state) => state.language);
    const setLanguage = useNavigationStore((state) => state.setLanguage);
    const t = useTranslation();

    const handleLanguageChange = async (val) => {
        setLanguage(val);
        await useLocalizationStore.getState().fetchDictionary(val);
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-background flex flex-col justify-center selection:bg-primary/30 selection:text-primary">
            <LanguageLoadingOverlay />
            
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-aurora-1" />
                <div className="absolute top-1/3 -left-10 w-[400px] h-[400px] bg-secondary/30 rounded-full blur-[120px] animate-aurora-2" />
                <div className="absolute -bottom-20 left-1/4 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[140px] animate-aurora-3" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            {/* Top Bar / Language Selector */}
            <div className="absolute top-6 right-6 md:top-8 md:right-12 z-50">
                <Select value={language || "English"} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-[140px] bg-card/80 backdrop-blur-md border-border font-bold text-sm shadow-sm">
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                            <SelectValue placeholder="Language" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Hindi">हिन्दी (Hindi)</SelectItem>
                        <SelectItem value="Bengali">বাংলা (Bengali)</SelectItem>
                        <SelectItem value="Gujarati">ગુજરાતી (Gujarati)</SelectItem>
                        <SelectItem value="Kannada">ಕನ್ನಡ (Kannada)</SelectItem>
                        <SelectItem value="Malayalam">മലയാളം (Malayalam)</SelectItem>
                        <SelectItem value="Marathi">मराठी (Marathi)</SelectItem>
                        <SelectItem value="Odia">ଓଡ଼ିଆ (Odia)</SelectItem>
                        <SelectItem value="Punjabi">ਪੰਜਾਬੀ (Punjabi)</SelectItem>
                        <SelectItem value="Tamil">தமிழ் (Tamil)</SelectItem>
                        <SelectItem value="Telugu">తెలుగు (Telugu)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pb-32 flex flex-col">
                {/* Editorial Hero Section */}
                <div className="flex flex-col text-center h-[calc(100vh-100px)] items-center justify-center">
                    <div className="rounded-full overflow-hidden w-32 h-32 mb-8">
                        <img src="/logo.png" alt="Logo" />
                    </div>
                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-foreground tracking-tighter leading-[0.9] mb-8">
                        {t('parallax')}
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl leading-relaxed mb-12  pl-6">
                        {t('hero_desc')}
                    </p>

                    <Button
                        onClick={() =>
                            signIn("google", { callbackUrl: "/onboarding" })
                        }
                        size="lg"
                        className="group relative h-16 md:h-20 px-8 md:px-12 rounded-full text-lg md:text-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground overflow-hidden shadow-xl transition-all duration-500 hover:scale-[1.02]"
                    >
                        <span className="relative z-10 flex items-center">
                            {t('explore_services')}
                            <ArrowRight className="ml-3 w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-transform duration-500" />
                        </span>
                    </Button>
                </div>

                {/* Glassmorphic Features Grid */}
                <div className="w-full flex justify-center mb-10">
                    <div className="inline-flex items-center px-6 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-bold tracking-widest uppercase">
                        {t('core_features')}
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 relative">
                    {[
                        {
                            icon: (
                                <Mic className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                            ),
                            title: t('feat_voice_title'),
                            desc: t('feat_voice_desc'),
                            border: "group-hover:border-primary/50",
                            glow: "group-hover:shadow-lg",
                            iconBg: "bg-primary/10 group-hover:bg-primary/20 text-primary",
                        },
                        {
                            icon: (
                                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-secondary" />
                            ),
                            title: t('feat_autofill_title'),
                            desc: t('feat_autofill_desc'),
                            border: "group-hover:border-secondary/50",
                            glow: "group-hover:shadow-lg",
                            iconBg: "bg-secondary/10 group-hover:bg-secondary/20 text-secondary",
                        },
                        {
                            icon: (
                                <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-accent-foreground" />
                            ),
                            title: t('feat_inclusive_title'),
                            desc: t('feat_inclusive_desc'),
                            border: "group-hover:border-accent-foreground/50",
                            glow: "group-hover:shadow-lg",
                            iconBg: "bg-accent/50 group-hover:bg-accent text-accent-foreground",
                        },
                        {
                            icon: (
                                <Globe className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                            ),
                            title: t('feat_lang_title'),
                            desc: t('feat_lang_desc'),
                            border: "group-hover:border-primary/50",
                            glow: "group-hover:shadow-lg",
                            iconBg: "bg-primary/10 group-hover:bg-primary/20 text-primary",
                        },
                        {
                            icon: (
                                <Save className="w-8 h-8 md:w-10 md:h-10 text-secondary" />
                            ),
                            title: t('feat_save_title'),
                            desc: t('feat_save_desc'),
                            border: "group-hover:border-secondary/50",
                            glow: "group-hover:shadow-lg",
                            iconBg: "bg-secondary/10 group-hover:bg-secondary/20 text-secondary",
                        },
                        {
                            icon: (
                                <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-accent-foreground" />
                            ),
                            title: t('feat_val_title'),
                            desc: t('feat_val_desc'),
                            border: "group-hover:border-accent-foreground/50",
                            glow: "group-hover:shadow-lg",
                            iconBg: "bg-accent/50 group-hover:bg-accent text-accent-foreground",
                        },
                    ].map((feat, i) => (
                        <div
                            key={i}
                            className={`group flex flex-col p-8 md:p-10 rounded-3xl bg-card/40 backdrop-blur-xl border border-border/50 shadow-sm transition-all duration-500 ease-out hover:-translate-y-2 ${feat.border} ${feat.glow}`}
                        >
                            <div
                                className={`p-4 md:p-5 rounded-2xl w-fit mb-8 transition-colors duration-500 ${feat.iconBg}`}
                            >
                                {feat.icon}
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 tracking-tight">
                                {feat.title}
                            </h3>
                            <p className="text-base md:text-lg text-muted-foreground font-medium leading-relaxed">
                                {feat.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <footer className="absolute bottom-6 w-full text-center z-10 text-muted-foreground/60 font-mono text-sm tracking-widest uppercase">
                <p>{t('footer')} &copy; {new Date().getFullYear()}</p>
            </footer>
        </main>
    );
}
