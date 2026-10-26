import { SAMPLE_CLAUSE as clause } from './content'

/**
 * The hero: one clause, marked up the way an advocate would - highlighter on
 * the wording that matters, a short note on what to do about it. The
 * highlighter is drawn once on load; under reduced motion it is simply there.
 */
export function MarkedUpPage() {
  return (
    <figure
      aria-label="Example: a lease clause, marked up by Pact Pulse"
      className="mx-auto w-full max-w-xl rounded-sm border border-[#D6DCDA] bg-white px-7 py-8 text-[#1B2A38] shadow-[0_1px_0_#D6DCDA,0_24px_48px_-28px_rgba(27,42,56,0.35)] sm:px-10 sm:py-10 dark:border-transparent"
    >
      <p className="font-grotesk text-sm text-[#1B2A38]/55">{clause.heading}</p>

      <p className="mt-3 font-document text-[1.15rem] leading-[1.75] text-[#2C3A47] sm:text-[1.25rem]">
        {clause.before}
        <mark
          className="animate-highlight bg-no-repeat px-0.5 text-inherit motion-reduce:animate-none"
          style={{
            backgroundColor: 'transparent',
            backgroundImage:
              'linear-gradient(transparent 12%, #F5E05E 12%, #F5E05E 88%, transparent 88%)',
            animationDelay: '500ms',
          }}
        >
          {clause.marked}
        </mark>
        {clause.after}
      </p>

      <figcaption className="mt-7 border-l-2 border-[#B3261E] pl-4 font-grotesk">
        <p className="text-sm font-semibold text-[#B3261E]">{clause.label}</p>
        <p className="mt-1 text-[1.02rem] leading-snug">{clause.meaning}</p>
        <p className="mt-1 text-[1.02rem] leading-snug text-[#1B2A38]/65">{clause.advice}</p>
      </figcaption>
    </figure>
  )
}
