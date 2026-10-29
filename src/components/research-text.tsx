import { researchDisplay } from "@/lib/research-display";

export function ResearchText({ text }: { text: string }) {
  const { paragraphs, technical } = researchDisplay(text);
  return (
    <div className="research-prose">
      {technical.length > 0 && paragraphs.length > 0 && (
        <p className="excerpt-note">
          Prose excerpts below. Calculation passages and their assumptions are
          preserved in details.
        </p>
      )}
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {!paragraphs.length && (
        <p>
          The recorded analysis is numerical. Open the calculation details
          below.
        </p>
      )}
      {technical.length > 0 && (
        <details className="technical-details">
          <summary>Calculations, data & accompanying assumptions</summary>
          {technical.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </details>
      )}
    </div>
  );
}
