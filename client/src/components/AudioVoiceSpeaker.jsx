import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AudioVoiceSpeaker({ textualContent }) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speaking]);

  const toggleVoicePlayback = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    if (!('speechSynthesis' in window)) {
      toast.error('Voice synthesizer unsupported in current client.');
      return;
    }

    const cleanedText = textualContent
      .replace(/[#*`~>]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (evt) => {
      if (evt.error !== 'interrupted' && evt.error !== 'canceled') {
        setSpeaking(false);
        toast.error('Voice synthesis failed.');
      }
    };

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      onClick={toggleVoicePlayback}
      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
        speaking
          ? 'bg-cyan-500/20 text-cyan-300'
          : 'text-slate-500 hover:text-slate-300 hover:bg-surface-800'
      }`}
      title={speaking ? 'Halt Playback' : 'Vocalize Response'}
    >
      {speaking ? (
        <>
          <VolumeX className="w-3.5 h-3.5" />
          <span>Stop</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5" />
          <span>Listen</span>
        </>
      )}
    </button>
  );
}
