![][header-image]

[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Greenkeeper badge](https://badges.greenkeeper.io/sammarks/workflow.svg)](https://greenkeeper.io/)
[![Travis](https://img.shields.io/travis/sammarks/workflow.svg)](https://travis-ci.org/sammarks/workflow)
[![Coveralls](https://img.shields.io/coveralls/sammarks/workflow.svg)](https://coveralls.io/github/sammarks/workflow)
[![Dev Dependencies](https://david-dm.org/sammarks/workflow/dev-status.svg)](https://david-dm.org/sammarks/workflow?type=dev)
[![Donate](https://img.shields.io/badge/donate-paypal-blue.svg)](https://paypal.me/sammarks15)

`workflow` is a NodeJS library designed to facilitate the execution of simple workflows with
rollback support. This allows you to take small units of code and combine them together into
a larger workflow to accomplish a single large task.

See [the documentation](https://sammarks.github.io/workflow/) for more details.

## Get Started

```sh
npm install @sammarks/workflow
yarn add @sammarks/workflow
```

```typescript
import { execute } from '@sammarks/workflow'

interface WorkflowContext {
  firstStepRun: boolean
  secondStepRun: boolean
  test: string
}

const workflow = [
  {
    name: 'first',
    run: async (context: WorkflowContext): Promise<void> => {
      context.firstStepRun = true
    },
    revert: async (context: WorkflowContext): Promise<void> => {
      context.firstStepRun = false
    }
  },
  {
    name: 'second',
    run: async (context: WorkflowContext): Promise<void> => {
      context.secondStepRun = true
    },
    revert: async (context: WorkflowContext): Promise<void> => {
      context.secondStepRun = false
    }
  }
]

const result = await execute<WorkflowContext>('test-workflow', workflow, { test: 'foo' })
console.log(result)

// {
//   firstStepRun: true,
//   secondStepRun: true,
//   test: 'foo'
// }
```

## Features

- Define steps in a simple, typed, array-object format.
- Steps and workflows are given names for debugging support.
- Rollback support in case a step fails.
- Predictable and documented error handling in case something goes wrong.

## Why use this?

Breaking the large task into smaller units of code allows a less complicated end result, and greater
unit testing abilities since each step in the workflow is broken into its own function.

Rollback support allows a transactional nature for executing workflows. If one step in the process
fails to execute, all previously-executed steps with a configured rollback are executed.

`workflow` provides TypeScript hinting and a predictable error interface to handle issues when they
arise.

[header-image]: https://raw.githubusercontent.com/sammarks/art/master/workflow/header.jpg
