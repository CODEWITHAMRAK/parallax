import React, { use } from 'react';
import AccessibleForm from '@/components/AccessibleForm.jsx';
import TextNavigationUI from '@/components/TextNavigationUI.jsx';

export default function FormPage({ params }) {
  const unwrappedParams = use(params);
  const { formId } = unwrappedParams;

  return (
    <main className="min-h-screen bg-background p-4 md:p-8 flex flex-col lg:flex-row gap-8 lg:gap-12">
      {/* Form Area - Left */}
      <div className="flex-1 lg:w-3/5 w-full max-w-[800px] mx-auto lg:mx-0 pt-4 md:pt-12 pb-32 lg:pb-12">
        <AccessibleForm formId={formId} />
      </div>
      
      {/* Voice/Chat Area - Right */}
      <div className="w-full lg:w-2/5 lg:sticky lg:top-0 lg:h-screen lg:-mt-8 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-border pt-8 lg:pt-0 lg:pl-8 z-10 bg-background">
        <TextNavigationUI inline={true} />
      </div>
    </main>
  );
}
