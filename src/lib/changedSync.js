// Preserve state transitions in order, share duplicate pending calls, and only
// skip a state after the server has confirmed it. Failures remain retryable.
export function createChangedSync(send) {
  let tail = Promise.resolve();
  let pending = null;
  let queuedSignature;
  let savedSignature;
  let savedResult;
  return (signature, payload, force = false) => {
    if (!force && pending && queuedSignature === signature) return pending;
    queuedSignature = signature;
    const operation = tail.catch(() => {}).then(async () => {
      if (!force && savedSignature === signature) return savedResult;
      const result = await send(payload);
      if (result.configured !== false && result.subscribed !== false) {
        savedSignature = signature;
        savedResult = result;
      }
      return result;
    });
    pending = operation;
    tail = operation;
    operation.then(() => { if (pending === operation) pending = null; }, () => { if (pending === operation) pending = null; });
    return operation;
  };
}
