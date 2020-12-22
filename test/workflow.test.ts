import { execute, StepContext, WorkflowError, WorkflowRevertError } from '../src/workflow'

interface TestContext extends StepContext {
  another?: string
  fallback?: boolean
  second?: boolean
}

describe('#execute()', () => {
  let firstStep: jest.Mock<Promise<void>, [TestContext]>
  let firstStepFallback: jest.Mock<Promise<void>, [TestContext]>
  let filteredStep: jest.Mock<Promise<void>, [TestContext]>
  let filteredStepFallback: jest.Mock<Promise<void>, [TestContext]>
  let secondStep: jest.Mock<Promise<void>, [TestContext]>
  let failStep: jest.Mock<Promise<void>, [TestContext]>
  let failStepRevertNoError: jest.Mock<Promise<void>, [TestContext]>
  let failStepRevert: jest.Mock<Promise<void>, [TestContext]>
  let thirdStep: jest.Mock<Promise<void>, [TestContext]>
  let thirdStepFallback: jest.Mock<Promise<void>, [TestContext]>
  let boom: Error
  let boomBoom: Error
  beforeEach(() => {
    boom = new Error('boom')
    boomBoom = new Error('boom boom')
    firstStep = jest.fn(async context => {
      expect(context).toEqual({ another: 'bar' })
    })
    firstStepFallback = jest.fn(async context => {
      context.fallback = true
    })
    filteredStep = jest.fn(async context => {
      throw new Error('this should not have been called')
    })
    filteredStepFallback = jest.fn(async context => {
      throw new Error('this should not have been called')
    })
    secondStep = jest.fn(async context => {
      expect(context).toEqual({ another: 'bar' })
      context.second = true
    })
    failStep = jest.fn(async context => {
      throw boom
    })
    failStepRevertNoError = jest.fn(async context => undefined)
    failStepRevert = jest.fn(async context => {
      throw boomBoom
    })
    thirdStep = jest.fn(async context => {
      expect(context).toEqual({ another: 'bar', second: true })
    })
    thirdStepFallback = jest.fn(async context => undefined)
  })
  describe('when all steps succeed', () => {
    let result: TestContext
    beforeEach(async () => {
      result = await execute<TestContext>(
        'test-workflow',
        [
          { name: 'first', run: firstStep, revert: firstStepFallback },
          {
            name: 'filtered',
            run: filteredStep,
            revert: filteredStepFallback,
            filter: () => Promise.resolve(false)
          },
          { name: 'second', run: secondStep },
          { name: 'third', run: thirdStep, revert: thirdStepFallback }
        ],
        { another: 'bar' }
      )
    })
    it('calls each step with the proper context', () => {
      expect(firstStep.mock.calls).toEqual([[result]])
      expect(firstStepFallback.mock.calls).toEqual([])
      expect(secondStep.mock.calls).toEqual([[result]])
      expect(thirdStep.mock.calls).toEqual([[result]])
      expect(thirdStepFallback.mock.calls).toEqual([])
    })
    it('does not call the filtered step', () => {
      expect(filteredStep).toHaveBeenCalledTimes(0)
      expect(filteredStepFallback).toHaveBeenCalledTimes(0)
    })
    it('returns the resulting context', () => {
      expect(result).toEqual({
        another: 'bar',
        second: true
      })
    })
  })
  describe('when one step fails', () => {
    beforeEach(async () => {
      try {
        await execute<TestContext>(
          'test-workflow',
          [
            { name: 'first', run: firstStep, revert: firstStepFallback },
            {
              name: 'filtered',
              run: filteredStep,
              revert: filteredStepFallback,
              filter: () => Promise.resolve(false)
            },
            { name: 'second', run: secondStep },
            { name: 'fail', run: failStep, revert: failStepRevertNoError },
            { name: 'third', run: thirdStep, revert: thirdStepFallback }
          ],
          { another: 'bar' }
        )
      } catch (err) {
        expect(err.message).toEqual("Workflow error executing 'fail': Error: boom")
        expect(err.originalException).toEqual(boom)
        expect(err.stepName).toEqual('fail')
      }
    })
    it('calls the revert steps', () => {
      expect(failStepRevertNoError.mock.calls).toEqual([
        [{ another: 'bar', second: true, fallback: true }]
      ])
      expect(firstStepFallback.mock.calls).toEqual([
        [{ another: 'bar', second: true, fallback: true }]
      ])
    })
    it('does not call the filtered revert step', () => {
      expect(filteredStepFallback).toHaveBeenCalledTimes(0)
    })
  })
  describe('when a revert step fails', () => {
    it('throws the original error with the revertFailure error', async () => {
      try {
        await execute<TestContext>(
          'test-workflow',
          [
            { name: 'first', run: firstStep, revert: firstStepFallback },
            { name: 'second', run: secondStep },
            { name: 'fail', run: failStep, revert: failStepRevert },
            { name: 'third', run: thirdStep, revert: thirdStepFallback }
          ],
          { another: 'bar' }
        )
      } catch (err) {
        expect(err.message).toEqual(
          "Workflow error executing 'fail': Error: boom\nAdditionally, error reverting step 'fail': Error: boom boom"
        )
        expect(err.originalException).toEqual(boomBoom)
        expect(err.originalWorkflowError.originalException).toEqual(boom)
        expect(err.originalWorkflowError.stepName).toEqual('fail')
        expect(err.stepName).toEqual('fail')
      }
    })
  })
})

describe('WorkflowError', () => {
  it('sets the appropriate properties', () => {
    const exception = new Error('boom')
    const instance = new WorkflowError('fail', exception)
    expect(instance.message).toEqual("Workflow error executing 'fail': Error: boom")
    expect(instance.originalException).toEqual(exception)
    expect(instance.stepName).toEqual('fail')
  })
})

describe('WorkflowRevertError', () => {
  it('sets the appropriate properties', () => {
    const exception = new Error('boom boom')
    const originalException = new Error('boom')
    const originalWorkflowError = new WorkflowError('fail', originalException)
    const instance = new WorkflowRevertError('fail', exception, originalWorkflowError)
    expect(instance.message).toEqual(
      "Workflow error executing 'fail': Error: boom\nAdditionally, error reverting step 'fail': Error: boom boom"
    )
    expect(instance.originalWorkflowError).toEqual(originalWorkflowError)
  })
})
