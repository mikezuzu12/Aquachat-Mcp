"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { translations, SUPPORTED_LANGUAGES } from "./translations";

// ... rest of the code
type LanguageContextType = {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  initialLanguage = "en" 
}: { 
  children: ReactNode; 
  initialLanguage?: string;
}) {
  const { data: session, update } = useSession();
  const user = session?.user as any;
  const [language, setLanguageState] = useState(initialLanguage);

  // Load language from session when available
  useEffect(() => {
    if (user?.language) {
      setLanguageState(user.language);
    }
  }, [user?.language]);

  const setLanguage = async (lang: string) => {
    try {
      const res = await fetch("/api/users/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      
      if (res.ok) {
        setLanguageState(lang);
        await update(); // Refresh session to get new language
      }
    } catch (error) {
      console.error("Failed to set language:", error);
    }
  };

  const t = (key: string): string => {
    const langTranslations = translations[language] || translations.en;
    return langTranslations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}