import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface FaqEntry {
  question: string;
  answer: string;
}

export function FaqSection({
  entries,
  heading = 'Frequently asked questions',
  description,
}: {
  entries: readonly FaqEntry[];
  heading?: string;
  description?: string;
}) {
  return (
    <section className="container py-16 sm:py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2
            id="faq-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {heading}
          </h2>
          {description ? (
            <p className="mt-4 text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {entries.map((entry, index) => (
            <AccordionItem key={entry.question} value={`item-${index}`}>
              <AccordionTrigger>{entry.question}</AccordionTrigger>
              <AccordionContent>{entry.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
