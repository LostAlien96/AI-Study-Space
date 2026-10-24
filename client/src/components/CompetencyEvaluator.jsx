import React, { useState, useEffect } from 'react';
import {
  Brain,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import gateway from '../services/gateway';
import toast from 'react-hot-toast';

export default function CompetencyEvaluator({
  workspaceId,
  operatorId,
  vendor,
  variant,
  onClose,
}) {
  const [inProgress, setInProgress] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [chosenAnswers, setChosenAnswers] = useState({});
  const [isEvaluationFinalized, setIsEvaluationFinalized] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState('');

  const initiateAssessment = async () => {
    setInProgress(true);
    setAssessment(null);
    setDiagnosticError('');
    setIsEvaluationFinalized(false);
    setActiveQuestionIndex(0);
    setChosenAnswers({});

    try {
      const resp = await gateway.post('/api/exam/generate', {
        session_id: workspaceId,
        user_email: operatorId || 'guest',
        provider: vendor,
        model: variant,
      });

      if (resp.data && resp.data.questions?.length > 0) {
        setAssessment(resp.data);
      } else {
        setDiagnosticError('No evaluation items synthesized. Ingest documents into the workspace first.');
      }
    } catch (err) {
      setDiagnosticError(err.response?.data?.detail || 'Assessment synthesis failed.');
    } finally {
      setInProgress(false);
    }
  };

  useEffect(() => {
    initiateAssessment();
  }, [workspaceId]);

  const selectAnswer = (questionId, option) => {
    if (isEvaluationFinalized) return;
    setChosenAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const calculateFinalScore = () => {
    if (!assessment) return 0;
    return assessment.questions.reduce((accum, q) => {
      return chosenAnswers[q.id] === q.correct_answer ? accum + 1 : accum;
    }, 0);
  };

  const commitEvaluation = async () => {
    const unanswered = assessment.questions.filter((q) => !chosenAnswers[q.id]);
    if (unanswered.length > 0) {
      toast.error('Complete all questions before submitting.');
      return;
    }

    setIsEvaluationFinalized(true);
    const score = calculateFinalScore();

    const missedItems = assessment.questions
      .filter((q) => chosenAnswers[q.id] !== q.correct_answer)
      .map((q) => ({
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        user_answer: chosenAnswers[q.id],
      }));

    try {
      await gateway.post('/api/exam/record', {
        session_id: workspaceId,
        user_email: operatorId || 'guest',
        score,
        total_questions: assessment.questions.length,
        incorrect_questions: missedItems,
      });
      toast.success(`Evaluation recorded! Final: ${score}/${assessment.questions.length}`);
    } catch (err) {
      console.error('Record outcome failure:', err);
    }
  };

  const activeQuestion = assessment?.questions[activeQuestionIndex];

  return (
    <div className="absolute inset-0 bg-surface-950/95 backdrop-blur-2xl z-50 flex flex-col p-4 md:p-8 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-800 shrink-0 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm md:text-base font-bold text-slate-100">
              Cognitive Competency Evaluator
            </h2>
          </div>
        </div>

        {assessment && !inProgress && (
          <button
            onClick={initiateAssessment}
            className="px-3 py-1.5 rounded-xl bg-surface-900 border border-surface-800 hover:bg-surface-850 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Re-synthesize
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        {inProgress && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 border-3 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-300">
              Synthesizing rigorous test items from knowledge base...
            </span>
          </div>
        )}

        {diagnosticError && (
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <p className="text-xs text-slate-400">{diagnosticError}</p>
            <button
              onClick={initiateAssessment}
              className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-slate-200 text-xs font-bold rounded-xl mt-2"
            >
              Retry
            </button>
          </div>
        )}

        {assessment && activeQuestion && (
          <div className="w-full max-w-xl flex-1 flex flex-col min-h-0">
            {/* Step Progress */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                {assessment.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`h-1.5 w-8 rounded-full transition-all ${
                      idx === activeQuestionIndex
                        ? 'bg-cyan-500'
                        : chosenAnswers[q.id]
                        ? 'bg-slate-700'
                        : 'bg-surface-850'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-slate-500">
                Item {activeQuestionIndex + 1} of {assessment.questions.length}
              </span>
            </div>

            {/* Question Text */}
            <div className="flex-1 overflow-y-auto hub-scrollbar space-y-4 pr-1">
              <div className="p-5 rounded-2xl bg-surface-900 border border-surface-800 text-sm font-semibold text-slate-100 leading-relaxed">
                {activeQuestion.question}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {activeQuestion.options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = chosenAnswers[activeQuestion.id] === option;
                  const isCorrect = option === activeQuestion.correct_answer;

                  let optionClasses = 'border-surface-800 bg-surface-900/40 hover:border-surface-700';
                  if (isSelected && !isEvaluationFinalized) {
                    optionClasses = 'border-cyan-500 bg-cyan-500/10 text-cyan-300';
                  }

                  if (isEvaluationFinalized) {
                    if (isCorrect) optionClasses = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300';
                    else if (isSelected) optionClasses = 'border-rose-500/50 bg-rose-500/10 text-rose-300';
                    else optionClasses = 'border-surface-850 opacity-40';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => selectAnswer(activeQuestion.id, option)}
                      disabled={isEvaluationFinalized}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all ${optionClasses}`}
                    >
                      <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs bg-surface-950 border border-surface-800 shrink-0">
                        {letter}
                      </span>
                      <span className="flex-1">{option}</span>
                      {isEvaluationFinalized && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {isEvaluationFinalized && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-400" />}
                    </button>
                  );
                })}

                {!isEvaluationFinalized && (
                  <button
                    onClick={() => selectAnswer(activeQuestion.id, "I Don't Know")}
                    className={`w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                      chosenAnswers[activeQuestion.id] === "I Don't Know"
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-surface-800 text-slate-500 hover:border-amber-500/50 hover:text-amber-400'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Flag for Spaced Repetition (IDK)
                  </button>
                )}
              </div>

              {isEvaluationFinalized && (
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-slate-300 leading-relaxed font-mono">
                  <span className="font-bold text-cyan-400 block mb-1">RATIONALE:</span>
                  {activeQuestion.explanation}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-surface-800 flex items-center justify-between shrink-0 mt-4">
              <button
                disabled={activeQuestionIndex === 0}
                onClick={() => setActiveQuestionIndex((prev) => prev - 1)}
                className="px-4 py-2 bg-surface-900 border border-surface-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold disabled:opacity-30"
              >
                Previous
              </button>

              {isEvaluationFinalized ? (
                activeQuestionIndex < assessment.questions.length - 1 ? (
                  <button
                    onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
                    className="px-4 py-2 bg-surface-900 hover:bg-surface-850 text-slate-200 rounded-xl text-xs font-bold"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                  >
                    Exit Review
                  </button>
                )
              ) : activeQuestionIndex < assessment.questions.length - 1 ? (
                <button
                  disabled={!chosenAnswers[activeQuestion.id]}
                  onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-surface-850 disabled:text-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled={Object.keys(chosenAnswers).length < assessment.questions.length}
                  onClick={commitEvaluation}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-900/30 disabled:opacity-40"
                >
                  Finalize Evaluation
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
