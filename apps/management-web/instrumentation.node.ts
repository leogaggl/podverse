/**
 * Node server startup. Loaded only when NEXT_RUNTIME is nodejs.
 */
export async function registerNodeInstrumentation(): Promise<void> {
  const { buildObservabilityConfigFromEnv } = await import('@podverse/observability/config');
  const { initObservability, registerNextHttpServerInstrumentation } =
    await import('@podverse/observability');

  initObservability(buildObservabilityConfigFromEnv(process.env));
  registerNextHttpServerInstrumentation();

  const { bootstrapManagementWebExtensions, registerManagementWebGracefulShutdownHandlers } =
    await import('./src/lib/extensions/bootstrapManagementWebExtensions');
  bootstrapManagementWebExtensions();
  registerManagementWebGracefulShutdownHandlers();

  const { warmManagementWebRuntimeConfigAtStartup } =
    await import('./src/config/runtime-config-bootstrap.server');
  await warmManagementWebRuntimeConfigAtStartup();
}
