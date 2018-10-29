# Live Dashboards PoC

The purpose of this PoC is to answer some questions regarding a two subjects:

1. How could we implement the UI using an external component that controls all the layout?
2. How would the interaction between the UI and the server work?

## UI and Layout

The UI was designed using our own Cobalt Design System. In the future, we'll need to add drag-and-drop and resizing functionality that is not currently provided by Cobalt. Even though we won't need this for the time being, we see the benefit of starting using something that allow us to add the necessary behavior without much effort. Therefore, we built the desired layout using [React Grid Layout](https://github.com/STRML/react-grid-layout). This library is pretty customizable and allows us to implement the layout we want without much work. All the layout is configured by a JSON object that is provided to the component, where we set the widget's size and position for every breakpoint, whether they are resizable, etc..

<details><summary>Layout configuration example</summary>

```json
{
  "lg": [
    {
      "w": 3,
      "h": 2,
      "x": 0,
      "y": 0,
      "i": "1",
      "minW": 3,
      "minH": 3,
      "moved": false,
      "static": true
    },
    {
      "w": 3,
      "h": 2,
      "x": 3,
      "y": 0,
      "i": "2",
      "minW": 3,
      "minH": 3,
      "moved": false,
      "static": true
    },
    {
      "w": 3,
      "h": 2,
      "x": 6,
      "y": 0,
      "i": "3",
      "minW": 3,
      "minH": 3,
      "moved": false,
      "static": true
    },
    {
      "w": 3,
      "h": 2,
      "x": 9,
      "y": 0,
      "i": "4",
      "minW": 3,
      "minH": 3,
      "moved": false,
      "static": true
    },
    {
      "w": 6,
      "h": 4,
      "x": 0,
      "y": 2,
      "i": "5",
      "minW": 6,
      "minH": 5,
      "moved": false,
      "static": true
    },
    {
      "w": 6,
      "h": 4,
      "x": 6,
      "y": 2,
      "i": "6",
      "minW": 6,
      "minH": 5,
      "moved": false,
      "static": true
    }
  ],
  "md": [...],
  "sm": [...],
  "xs": [...],
  "xxs": [...]
}
```

</details><br>
Starting the project with this layout definition can minimize the work needed in the future and gives us a pretty good base for our dashboard's definition.

## Interaction with the server

There are several interactions we need to do with the server. We need to get the dashboards list and also the selected dashboard's definition to know how to render it, but we're already used to deal with these kinds of interactions. For the Live Dashboards, the server will talk to the application via Server-Side Events (SSE) as well. The client application needs to create an `EventSource` instance to open a connection to the server. After this, we need to set what we want to do when a new message is sent.

```js
const source = new EventSource('<subscription_endpoint>')

source.onmessage = function(event) {
  console.log(event)
}
```

We're doing something similar to subscribe to two different metrics and storing the new values sent by the server. These values are then shown in the corresponding widgets.

### Handling errors

As opposed to what we currently do in TD Live, we want to provide feedback to the user when something wrong is happening and they are not receiving updates. A connection has three states: `CONNECTING`, `OPEN`, and `CLOSED`. Depending on the error, the connection changes from `OPEN` to either `CONNECTING` or `CLOSED`. We're relying on these states to decide which message to show the user.

```js
source.onerror = function() {
  switch (source.readyState) {
    case source.CONNECTING: {
      // show a message saying that we might be having issues
      break
    }
    case source.CLOSED: {
      // show a message saying we cannot recover, they need to refresh or contact support
      break
    }
  }
}
```

When the connection state is set to `CLOSED` when an error occurs, we won't be able to recover and we'll need to create a new connection. However, when the state is set to `CONNECTING`, there's a chance the connection will be established once again. In those cases, the message stops showing.
