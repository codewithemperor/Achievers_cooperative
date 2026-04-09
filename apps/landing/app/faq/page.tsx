import { Accordion, AccordionItem } from "@heroui/react";
import { SectionHeader } from "@achievers/ui";

const faqs = [
  {
    key: "1",
    title: "Can members access the platform on mobile devices?",
    body: "Yes. The member application is planned as a progressive web app that can be installed and used with an app-like experience."
  },
  {
    key: "2",
    title: "Will administrators use the same interface as members?",
    body: "No. The platform separates the member experience from the administrative portal while keeping both connected to one backend."
  },
  {
    key: "3",
    title: "How are wallet funding transactions handled?",
    body: "Members upload a receipt after bank transfer, then administrators verify the payment before the wallet balance is credited."
  },
  {
    key: "4",
    title: "What features are planned for the MVP?",
    body: "Authentication, member management, wallet basics, transaction history, basic loan features, and a lightweight admin dashboard."
  }
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <SectionHeader
        eyebrow="FAQ"
        title="Questions cooperative stakeholders usually ask"
        description="This content gives the public site a clear information layer before users reach the product."
      />
      <Accordion className="mt-12" variant="splitted">
        {faqs.map((faq) => (
          <AccordionItem key={faq.key} aria-label={faq.title} title={faq.title}>
            <p className="text-sm leading-7 text-slate-600">{faq.body}</p>
          </AccordionItem>
        ))}
      </Accordion>
    </main>
  );
}
