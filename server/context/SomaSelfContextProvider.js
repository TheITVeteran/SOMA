import { buildSomaContext, isSomaSelfQuery } from './SomaContextKernel.js';

export async function buildSomaSelfContext(query = '', options = {}) {
    const context = await buildSomaContext(query, options);
    return context.replace('[SOMA CONTEXT KERNEL]', '[SOMA SELF-CONTEXT]').replace('[/SOMA CONTEXT KERNEL]', '[/SOMA SELF-CONTEXT]');
}

export { isSomaSelfQuery as isSelfAccessQuery };

export default {
    buildSomaSelfContext,
    isSelfAccessQuery: isSomaSelfQuery
};
