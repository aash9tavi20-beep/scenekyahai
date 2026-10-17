import enigmaArt from "@/assets/question-enigmas.jpg";

export function QuestionArt({ stage }: { stage: number }) {
  return <div className={`question-art question-art-${stage % 4}`} aria-hidden="true">
    <div className="question-art-left"><img src={enigmaArt} alt="" width={768} height={1536} loading="lazy" /></div>
    <div className="question-art-right"><img src={enigmaArt} alt="" width={768} height={1536} loading="lazy" /></div>
  </div>;
}