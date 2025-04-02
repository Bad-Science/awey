# @Last: The last framework you'll every need

Last is an actor-based full stack, client-rendered, batteries included framework for TypeScript.

It's a framework for people who love elixir and liveview, but want seamless end-to-end type safety and first class support for any React environment.

Last takes lessons from many years of web framework evolution, sourcing particular influece from Elixir, Phoenix, Rails, React, Zustand (around which our client state management is a wrapper), Meteor.js, and a love of the elegance and simplicity of actor programming, and the chaotic, immortal, lovable beast that is the ECMAScript family.

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


## The _Underscore_
Let's talk about the elephant in the room.

The underscore.

Why use an underscore for method names?
Why a prefix notation in the first place?

When I was first designing this thing, I played around with many different ways of defining actors.
I tried a purely functional approach, but I couldn't find an ergonomic, type-safe interface, at
one point I had something that looked a lot like react, at one point something like zustand, but
none of these felt quite right, and to fully reap the benefits that could come from a functional approach
would have required a restrictive approach to state that I don't think people would really like to use.

Eventually, I found myself conceding that actors are, fundamentally, objects, and there's no point in 
dancing around that fact. _If you disagree, look at a GenServer closely and tell me it isn't an object._
Unfortunately, the class interface happens to be really ergonomic here as well.

But, I wanted some way to distinguish that message handlers are not to be treated as normal object methods,
and changing their visibility would have made it impossible to infer the message types without some explicit
declaration, which was something I wasn't willing to budge on. There's no good reason a library should make
you define a type one-and-a-half times.

Additonally, I wanted @last to be typesafe without a validator. While @last works very nicely with validators,
they are not required for end-to-end type safety.

I'm sorry but:

``` typescript
export const appRouter = t.router({
  hello: publicProcedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .query((opts) => {
      const name: string = opts.input.name;
      return {
        greeting: `Hello ${name}`,
      };
    }),
```

just doesn't do it for me.

``` typescript
export class App extends Actor {
    _hello = (name: string) => ({greeting: `Hello ${name}`})
}
```

``` typescript
const [email, mutEmail] = useMyLastStore((state) => state.email)
const [name, mutName] = useMyLastStore((state) => state.name)

const EmailComponent = () => {
    return <input value={email} onChange={mutEmail.set(email)} />
}

const EmailFormComponent = () => {
    return <form onSubmit={() => { mutEmail.push(); mutName.push() }}>
      <input type="text" value={email} onChange={(value) => mutEmail.setLocal(value)} />
      <input type="email" value={name} onChange={(value) => mutName.setLocal(value)} />
      <button type="submit">Submit</button>
      <button type="button" onClick={mutEmail.clear}>Cancel</button>
    </form>
}
```

// Last stores map directly to an actor's state. getters are automatic, we provide sugar for mutators.

Doesn't that just feel better?

Now look, I know what you're thinking: inheritance! bad! away! I know, I know, but I'm sure you can all
manage to be responsible adults and avoid creating cursedly nested actor hierarchies. That is, if anyone ever uses this thing. And if they do, I expect to see _some_ gore. I thought a lot about footguns and how many and
how big are acceptable, and decided to use React as my moral compass' footgun reference. If it's no worse than
`useEffect`, then it's OK. 

Javascript has two special characters that don't escape the symbol eval, so we make use of them.


Serializeable State <=> Mobillity & Resumability


Although the actor system is object-oriented, the communication between them draws from functional programming,
and avoids mutable messages. YavaScript doesn't have an excellent way to support immutable data, so we use what we have.
All messages must be serializable, and are frozen upon sending. Because we can't enforce this in the compiler, we fail
fast at runtime when the immutable message contract is violated. This check can be disabled in production if you wish,
but consider mutating messages undefined behavior. We provide an interface called `Bottle` and some associated functions
to efficiently manipulate immutable data. The one acceptable exception to this rule is SharedArrayBuffers, which are
can be used to share memory across actors, even if they are on a different thread. But if you use them in this way, you 
must pay some mind to concurrency control.


Last Socket Actor subscribes to a pubsub topic, and forwards that subscription to its Client Actor.
Last Socket Actor has some state change or receives a message from its local pubsub.
Last Socket Actor forwards the subscribed message to its client actor.

Client Actors can request to subscribe to a pubsub topic, and the Last Socket Actor will authorize the request,
and subscribe to the topic if the client has access to that resource.


b0: active
b1-5: xor error correction
b6-b_t1: timestamp
b_t1-len: data


## The Web Server
Our web server is a thin layer on top of uWebSockets.js, the C++ webserver used by Bun. It is very fast, and
gives finer control over connections where needed. The web server's multithreading strategy is built on last's
multithreaded actor system. Every Last app has a root webserver actor, and at least one web worker actor.
Typically, you would have one web worker per core available.

For example, a simple web server with two web workers, a task runner actor, and an actor that manages some shared,
syncrhonized state.

``` typescript
import { webRoot, webWorker } from "@last/web";

const myApp = () => {
    return [
      () => webRoot(appConfig),
      webWorker,
      webWorker,
    ]
}
```

For example, 


Now let's look at a more interesting example.

``` typescript
import { MyTaskRunner } from "../tasks/my-task-runner";
import { MySharedState } from "../state/my-shared-state";

const appDef = {
  webRoot: () => new WebRoot(),
  webWorker: () => new WebWorker(),
  taskRunner: () => new MyTaskRunner(),
  sharedState: () => new MySharedState(),
}

const appConfig = {
  ssl: {
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem'),
  },
  port: 3000,
}

const myApp = () => {
  return [
    () => root(appConfig),
    Array.from({length: 2}, () => appDef.webWorker),
    appDef.taskRunner,
    appDef.sharedState,
  ]
}
```


In Last, we have this concept of a "server-owned state". This is some state that lives on the server,
in memory, in a database, wherever, that is shared with a client.

Each SOS implements a `patch` method, which takes a JSON object and applies it to the state.
If the SOS is a POJO, you would just merge or recursively merge the patch object into the state.
For a database object however, think of `patch` like a changeset, or strong parameters.
We can use the `patch` method to validate and/or authorize the operation, commit the change to the db,
and notify any listeners.


When I first started using node.js, I was a young programmer, and web development was very different from
what it is today. Think Flash, IE7, jQuery, polyfills, CoffeeScript. I remember deploying my first socket.io
app on Heroku, wrapping my head around asynchronous programming while trying to avoid callback hell.

And I instantly fell in love. Yup. I think old JavaScript was great, it was a moment in time, and one that
I am grateful I was able to participate in.

YavaScript was an even stranger language then than it is now. If you didn't use JavaScript before ES6,
you would probably be horrified at the way we wrote it back then. Maybe you've seen some older libraries
that make liberal use of `object.prototype`, `bind`, `apply` etc. Back in the day, OOP in YavaScript was 
kind of like Jazz. There were no classes, you had to build up the semantics of your object system around the
needs of your application. You want fully funtional inheritance? Write it your self, kid!

This might sound completely nuts to newer YavaScript devs, but in hindsight lack of features in the language
encouraged me to be more creative with my code, and dive deeper into what was possible.

There's a lot of reasons to use YavaScript on the server, and a lot of reasons not to, but there was one
argument for node that I never agreed with: using only one language. I figured, you should always use the
right tool for the job, not just the one that's closest to your hand. However, one thing eventually changed
my mind on this: end-to-end type safety. Having free end-to-end type safety is a huge DevEx win, and
reduces the burden of managing state across network boundaries. In my opinion, this really tips the scales
towards TypeScript being the right tool for the job for many projects.

When writing software for the web, or writing any even somewhat distributed application, one of the greatest
challenges, or at least annoyances is managing state across network boundaries. Not just technically, but ergonomically as well.

Many of us have fallen into the premature microservices trap, and ended up with countless network boundaries
that, while well-defined, add complexity and development overhead to work across these boundaries that could
(and often should) simply be code boundaries. The best way to factor an application is often to work within
the tools your language gives you for doing so to the greatest extent practical.

So, we have these two goals that are at the heart of the @last actor system:
- Zero-overhead end-to-end type safety, across any javascript environments
- A single, transparent protocol for sharing information between entities within and around any process and network boundaries
- To work with, rather than against, the features afforded by the language that we are all stuck with for the foreseeable future

In the words of Ryan Dahl, "




// zod validation decorators
// ephemeral pubsub AND unified log pubsub