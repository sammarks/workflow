export type StepContext = object
export type StepFunction = (context: StepContext) => Promise<void>

export interface Step {
  name: string
  run: StepFunction
  revert?: StepFunction
}

export interface WorkflowErrorInterface extends Error {
  originalException: Error
  stepName: string
}

export interface WorkflowRevertErrorInterface extends WorkflowErrorInterface {
  originalWorkflowError: WorkflowError
}

export class WorkflowError extends Error implements WorkflowErrorInterface {
  originalException: Error
  stepName: string

  constructor(stepName: string, originalException: Error) {
    super(`Workflow error executing '${stepName}': ${originalException}`) /* istanbul ignore next */
    this.stepName = stepName
    this.originalException = originalException
  }
}

export class WorkflowRevertError extends WorkflowError implements WorkflowRevertErrorInterface {
  originalWorkflowError: WorkflowError

  constructor(stepName: string, error: Error, originalWorkflowError: WorkflowError) {
    super(stepName, error) /* istanbul ignore next */
    this.originalWorkflowError = originalWorkflowError
    this.message = `Workflow error executing '${originalWorkflowError.stepName}': ${originalWorkflowError.originalException}\nAdditionally, error reverting step '${stepName}': ${error}`
  }
}

export const execute = async <T extends StepContext>(
  name: string,
  steps: Array<Step>,
  context: T
): Promise<T> => {
  const revertSteps: Array<Step> = []
  console.info(`Starting workflow: '${name}'`)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.revert) revertSteps.push({ name: step.name, run: step.revert })
    try {
      console.info(`- Step: ${step.name}`)
      await step.run(context)
    } catch (e) {
      console.error(` Failed.`)
      console.error(e)
      const workflowError = new WorkflowError(step.name, e)
      try {
        await execute(`${name} (revert)`, revertSteps, context)
      } catch (err) {
        throw new WorkflowRevertError(err.stepName, err.originalException, workflowError)
      }
      throw workflowError
    }
  }

  console.info('Complete')
  return context
}

export default execute
