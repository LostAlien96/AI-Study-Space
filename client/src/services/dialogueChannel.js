import gateway from './gateway';

const BASE_ENDPOINT = gateway.defaults.baseURL;

/**
 * Functional streaming consumer that dispatches token fragments and metadata packets.
 */
export async function streamDialogueExchange({
  prompt,
  vendor,
  variant,
  workspaceId,
  operatorId,
  onFragmentReceived,
  onPacketEmitted,
}) {
  const requestPayload = {
    query: prompt,
    provider: vendor,
    model: variant,
    session_id: workspaceId || 'workspace_primary',
    user_id: operatorId || 'guest',
  };

  const responseStream = await fetch(`${BASE_ENDPOINT}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
  });

  if (!responseStream.ok) {
    throw new Error(`Gateway returned status: ${responseStream.status}`);
  }

  const streamReader = responseStream.body.getReader();
  const textDecoder = new TextDecoder('utf-8');
  let leftoverChunk = '';

  while (true) {
    const { done, value } = await streamReader.read();
    if (done) break;

    const chunkContent = leftoverChunk + textDecoder.decode(value, { stream: true });
    const segmentedLines = chunkContent.split('\n');
    leftoverChunk = segmentedLines.pop() || '';

    segmentedLines
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((cleanLine) => {
        try {
          const packet = JSON.parse(cleanLine);
          if (packet.type === 'text' || packet.type === 'error') {
            onFragmentReceived(packet.content);
          } else if (packet.type === 'metadata' && onPacketEmitted) {
            onPacketEmitted(packet);
          }
        } catch (err) {
          console.error('Packet parsing exception:', err);
        }
      });
  }

  if (leftoverChunk.trim()) {
    try {
      const packet = JSON.parse(leftoverChunk);
      if (packet.type === 'text') onFragmentReceived(packet.content);
      else if (packet.type === 'metadata' && onPacketEmitted) onPacketEmitted(packet);
    } catch {}
  }
}

/**
 * Requests backend entity and relation extraction for knowledge topology.
 */
export async function extractConceptTopology(textBlock, vendor, variant) {
  try {
    const reply = await fetch(`${BASE_ENDPOINT}/api/graph/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textBlock, provider: vendor, model: variant }),
    });

    if (!reply.ok) throw new Error('Topology synthesis rejected');
    return await reply.json();
  } catch (error) {
    console.error('Topology extraction failure:', error);
    return { nodes: [], links: [] };
  }
}
