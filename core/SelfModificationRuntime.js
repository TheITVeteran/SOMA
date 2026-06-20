import { SelfModificationPipeline } from './SelfModificationPipeline.js';

export function wireSelfModificationRuntime(system, logger = console) {
    if (system.selfModPipeline) return system.selfModPipeline;
    if (!system.engineeringSwarm) {
        throw new Error('SelfModificationPipeline requires EngineeringSwarmArbiter');
    }

    const pipeline = new SelfModificationPipeline();
    pipeline.initialize(system);
    system.selfModPipeline = pipeline;
    logger.log('[SOMA V2] SelfModificationPipeline wired: review, NEMESIS, verification, and rollback enforced');
    return pipeline;
}
