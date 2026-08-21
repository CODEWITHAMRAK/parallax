import React, { use } from 'react';
import AccessibleForm from '@/components/AccessibleForm.jsx';
import TextNavigationUI from '@/components/TextNavigationUI.jsx';

export default function FormPage({ params }) {
  const unwrappedParams = use(params);
  const { formId } = unwrappedParams;

  return (
    <main className="min-h-screen bg-background pb-[250px] pt-12 md:pt-24 px-4">
      <div className="max-w-[800px] mx-auto mb-12">
        <AccessibleForm formId={formId} />
      </div>
      <TextNavigationUI />
    </main>
  );
}
