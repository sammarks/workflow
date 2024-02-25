import Debug from 'debug'

const debug = Debug('workflow')

/** The context passed to all steps and their filter functions. */
export type StepContext = object
/**
 * A callback executed whenever running a step, or reverting it.
 * @param context - the current step context
 * @returns a promise
 */
export type StepFunction<Context extends StepContext> = (context: Context) => Promise<void>
/**
 * Determines whether or not a step should be run.
 * @param context - the current step context
 * @returns a promise resolving to a boolean indicating if the step should run
 */
export type StepFilter<Context extends StepContext> = (context: Context) => Promise<boolean>

/** A step to run inside a workflow. */
export interface Step<Context extends StepContext> {
  /** The name of the step, for logging purposes. */
  name: string
  /** An optional filter to determine if the step should be run. */
  filter?: StepFilter<Context>
  /** The callback to execute the step. */
  run: StepFunction<Context>
  /** An optional revert callback, if the step has logic that needs to be reverted. */
  revert?: StepFunction<Context>
}

/** A low-level interface specifying workflow-specific additions to an error. */
export interface WorkflowErrorInterface extends Error {
  /** The original thrown exception */
  originalException: Error
  /** The name of the step the error was thrown on */
  stepName: string
}

/** A WorkflowErrorInterface, thrown during the revert process. */
export interface WorkflowRevertErrorInterface extends WorkflowErrorInterface {
  /** The original workflow error thrown before the revert error. */
  originalWorkflowError: WorkflowError
}

/** A wrapper around the error class, thrown when an error occurs in the workflow. */
export class WorkflowError extends Error implements WorkflowErrorInterface {
  originalException: Error
  stepName: string

  constructor(stepName: string, originalException: Error) {
    super(`Workflow error executing '${stepName}': ${originalException}`) /* istanbul ignore next */
    this.stepName = stepName
    this.originalException = originalException
  }
}

/** A wrapper around the workflow error class, thrown when an error occurs during the revert phase of a workflow. */
export class WorkflowRevertError extends WorkflowError implements WorkflowRevertErrorInterface {
  originalWorkflowError: WorkflowError

  constructor(stepName: string, error: Error, originalWorkflowError: WorkflowError) {
    super(stepName, error) /* istanbul ignore next */
    this.originalWorkflowError = originalWorkflowError
    this.message = `Workflow error executing '${originalWorkflowError.stepName}': ${originalWorkflowError.originalException}\nAdditionally, error reverting step '${stepName}': ${error}`
  }
}

/**
 * Executes a workflow.
 * @param name - the name of the workflow to execute
 * @param steps - an array of steps used to define the workflow
 * @param context - the default context to pass to all steps
 * @returns a promise resolving to the final context
 */
export const execute = async <T extends StepContext>(
  name: string,
  steps: Array<Step<T>>,
  context: T
): Promise<T> => {
  const revertSteps: Array<Step<T>> = []
  debug(`Starting workflow: '${name}'`)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    // Skip the step if the filter reports it should not be run.
    if (step.filter && !(await step.filter(context))) continue
    if (step.revert) revertSteps.push({ name: step.name, run: step.revert })
    try {
      debug(`- Step: ${step.name}`)
      await step.run(context)
    } catch (e) {
      debug(` Failed.`)
      debug(e)
      const workflowError = new WorkflowError(step.name, e)
      try {
        await execute(`${name} (revert)`, revertSteps, context)
      } catch (err) {
        throw new WorkflowRevertError(err.stepName, err.originalException, workflowError)
      }
      throw workflowError
    }
  }

  debug('Complete')
  return context
}

export default execute
