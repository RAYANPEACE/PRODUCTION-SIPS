export function normalizeInventoryContributionPayload(payload) {
  payload = payload || {};
  const freshCodes = Array.isArray(payload.freshCodes)
    ? [...new Set(payload.freshCodes.map(c => String(c)).filter(Boolean))]
    : [];
  const sourceCounts = (payload.counts && typeof payload.counts === 'object')
    ? payload.counts
    : (payload.st && payload.st.c && typeof payload.st.c === 'object') ? payload.st.c : {};
  const counts = {};
  for (const code of freshCodes) {
    if (sourceCounts[code] && sourceCounts[code].counted) counts[code] = sourceCounts[code];
  }
  return { freshCodes, counts, countedCodes: Object.keys(counts) };
}

export function buildInventoryContributionRecord(params) {
  const payload = params.payload || {};
  const user = params.user || {};
  const session = params.session || {};
  const agent = String(payload.agent || user.nom || '').trim() || user.nom || '';
  const countedCodes = params.countedCodes || [];
  return {
    id: params.id,
    userId: user.id,
    username: user.username,
    agent,
    counted: countedCodes.length,
    freshCount: countedCodes.length,
    submittedAt: params.submittedAt,
    note: String(params.note || '').trim(),
    payload: {
      baseInventoryId: session.baseInventoryId || null,
      baseDate: session.baseDate || '',
      agent,
      freshCodes: countedCodes,
      counts: params.counts || {},
      cfg: payload.cfg || {}
    }
  };
}

export function upsertInventoryContribution(session, record, opt) {
  opt = opt || {};
  session.contributions = session.contributions || [];
  const existing = session.contributions.findIndex(c => c.userId === record.userId);
  if (existing >= 0 && opt.mergeSameUser) {
    const prev = session.contributions[existing];
    const prevPayload = (prev && prev.payload) || {};
    const mergedCounts = Object.assign({}, prevPayload.counts || {}, record.payload.counts || {});
    const mergedCodes = [...new Set([...(prevPayload.freshCodes || []), ...(record.payload.freshCodes || [])])];
    record.payload.counts = mergedCounts;
    record.payload.freshCodes = mergedCodes;
    record.counted = mergedCodes.length;
    record.freshCount = mergedCodes.length;
    session.contributions[existing] = record;
  } else if (existing >= 0) {
    session.contributions[existing] = record;
  } else {
    session.contributions.push(record);
  }
  session.updatedAt = record.submittedAt;
  return { existingIndex: existing, created: existing < 0, contribution: record };
}
