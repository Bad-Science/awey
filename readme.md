# @Last: The last framework you'll every need

Last is an actor-based full stack, client-rendered, batteries included framework for TypeScript.

Last takes lessons from many years of web framework evolution, sourcing particular influece from Elixir, Phoenix, Rails, React, Zustand (around which our client state management is a wrapper), Meteor.js, and a love of the elegance and simplicity of actor programming, and the chaotic, immortal, lovable beast that is ECMAScript.

I hope you enjoy using it as much as I enjoyed creating it.

## Goals
- Opinionated. There is a correct way to do just about anything you'd to do in a web app, and following those conventions
should result in no less than an excellent, consistent DevEx. There is one way to structure your project, one way to 
manage your routes, etc. We call this The Last Way (see: The Rails Way)
- Mindful dependencies. We aren't re-inventing the wheel when it comes to, say, on ORM (not yet anyway), but @Last's
top level dependencies should be mininal, and decrease over time rather than increase.
- Support any React environment. @Last provides a client-side router that matches the @Last project structure, and hooks
that can be used in any React app.
- Direct, scoped, live data access with idiomatic hooks and mutations. Defined once on your server and used on the client without any friction. It's true model-view-controller, and takes the worry of managing state across network boundaries completely off you plate.

### Principles for building actor-based full stack apps with client side rendering
- Reactive Locality: The only global state is your router. All other shared state is page-local, and client state is
component-local. You can break this convention, but it's not The Last Way. (Layouts are treated like higher order pages)
The exception to this is Layout Controllers, which provide state for a react layout (in the form of a react context containing a zustand store)
Nested routes will have all the context of their parents, and default loading views can be provided to handle initial state gathering and connection opening.
- Structural DRYness
While not all business logic can (or should) be particularly dry, it is nice to reduce repetitive structural logic across your domains. Propagating events and state transitions throughout the boundaries of your application can be extremely tedious, and is a common source of errors. Managing and events state can be hard! Last tries to make it easier by providing robust, single-definition abstractions for mutating and reacting to state from the client to the server and vice vera. Think networked zustand stores (because we use them!)
- Highly declarative React
React code is generally cleanest and easiest to reason about when it is more declarative and less imperative, so our server-managed state abstractions aim to guide developers toward a more purely reactive frontend.
- Minimal boilerplate
Any boilerplate that is needed should be generated easily, but lean heavily towards
fewer files, sane defaults, and _convention over configuration_
- All state should be contained within actors. global state can lean to unpredictable behavior, and requires thinking about thread safety

### Details
Last projects use a monorepo structure. A web app is a package, and any other services you may want in your cluster are other packages.
Actor types can be shared across packages, and Last's mailboxing system makes sending messages to actors on other nodes transparent.
- Name registry needs to be distributed across all nodes
the registry may need to exist in its own package

"@_last_/framework"



The actor system can inject dependency contexts into spawned actors, which can be managed by the thrading system.
In JS, actors are more of a logical concept than a concurrency one. Therefore, you should lean towards making actors that allows you to
structure your code around its logic and business domains, and worry less about concurrency (within a thread).

When a thread hits a top level error, it can send a warning to its supervisor, which can remove it from its children and/or restart it
In a multithreaded model, all global state will have to be unsafe. that is a reasonable restriction.

client<->server mutations should be JSON patches
maybe the zustand wrapper could provide mutation middleware that updates the client state, sets a loading flag, 