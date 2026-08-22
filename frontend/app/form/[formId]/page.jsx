import React, { use } from 'react';
import AccessibleForm from '@/components/AccessibleForm.jsx';
import TextNavigationUI from '@/components/TextNavigationUI.jsx';

export default function FormPage({ params }) {
  const unwrappedParams = use(params);
  const { formId } = unwrappedParams;

  return (
    <main className="min-h-[calc(100vh-64px)] w-full bg-background flex flex-col lg:flex-row relative">
      {/* Form Area - Takes all remaining screen width */}
      <div className="flex-1 w-full min-w-0 p-4 sm:p-6 md:p-8 lg:p-12 pb-[380px] lg:pb-16 overflow-y-auto">
        <AccessibleForm formId={formId} />
      </div>
      
      {/* Conversation Area - Right 30-35% on Large Screens, Responsive Bottom Dock on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-3 sm:p-4 max-h-[48vh] overflow-y-auto lg:max-h-none lg:overflow-visible lg:static lg:w-[35%] xl:w-[32%] lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:border-t-0 lg:border-l lg:border-slate-200 lg:bg-slate-50/50 lg:p-6 lg:flex lg:flex-col lg:justify-between lg:shadow-none shrink-0">
        <TextNavigationUI inline={true} />
      </div>
    </main>
  );
}
