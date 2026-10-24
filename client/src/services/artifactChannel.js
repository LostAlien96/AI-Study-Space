import gateway from './gateway';

export async function uploadArtifact(fileHandle) {
  const payloadData = new FormData();
  payloadData.append('file', fileHandle);

  const outcome = await gateway.post('/upload', payloadData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return outcome.data;
}

export async function indexArtifact(artifactName) {
  const outcome = await gateway.post(`/process/file/${encodeURIComponent(artifactName)}`);
  return outcome.data;
}

export async function indexWebSource(targetUrl) {
  const outcome = await gateway.post('/process/url', { url: targetUrl });
  return outcome.data;
}

export async function transcribeAudioVoice(audioSampleBlob) {
  const voiceData = new FormData();
  voiceData.append('file', audioSampleBlob, 'vocal_input.wav');

  const outcome = await gateway.post('/voice/transcribe', voiceData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return outcome.data;
}
