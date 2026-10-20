/**
 * Node server startup. Loaded only when NEXT_RUNTIME is nodejs.
 */
export async function registerNodeInstrumentation(): Promise<void> {
  const { buildObservabilityConfigFromEnv } = await import('@podverse/observability/config');
  const { initObservability, registerNextHttpServerInstrumentation } =
    await import('@podverse/observability');

  initObservability(buildObservabilityConfigFromEnv(process.env));
  registerNextHttpServerInstrumentation();

  const { bootstrapWebExtensions, registerWebGracefulShutdownHandlers } =
    await import('./src/lib/extensions/bootstrapWebExtensions');
  bootstrapWebExtensions();
  registerWebGracefulShutdownHandlers();

  const { warmWebRuntimeConfigAtStartup } =
    await import('./src/config/runtime-config-bootstrap.server');
  await warmWebRuntimeConfigAtStartup();
}
