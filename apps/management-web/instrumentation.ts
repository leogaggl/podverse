/**
 * Runs once when the Next.js server starts. Node startup is a separate module so the
 * edge bundle does not load Node modules.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNodeInstrumentation } = await import('./instrumentation.node');
    await registerNodeInstrumentation();
  }
}
