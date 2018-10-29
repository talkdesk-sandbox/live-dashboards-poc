import React, { Component } from 'react'
import CobaltRoot, { Page, Button, Card, Grid, Header, H1, H5, Icon, Section, Color, Divider, Tooltip, Paragraph, Dropdown, Loader, Message } from 'cobalt-react-components'
import { WidthProvider, Responsive } from 'react-grid-layout'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const noop = () => {}
const API_URL = 'https://localhost:8443'

const ResponsiveGridLayout = WidthProvider(Responsive)
const Number = ({ children }) => (
  <span style={{fontSize: '80px'}}>{children}</span>
)

const getDashboards = () => fetch(`${API_URL}/dashboards`).then(res => res.json())
const getDashboardDefinition = dashboardId => fetch(`${API_URL}/dashboards/${dashboardId}/definition`).then(res => res.json())

class Dashboard extends React.Component {
  render() {
    // layout is an array of objects, see the demo for more complete usage
    const definition = this.props.definition

    return (
      <ResponsiveGridLayout className="layout" layouts={definition.layouts}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        cols={{ lg: 12, md: 6, sm: 6, xs: 3, xxs: 3 }}
        breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}>
        {this.props.children}
      </ResponsiveGridLayout>
    )
  }
}

const Widget = ({ title, subtitle, children }) => (
  <Card fullHeight small>
    <Header borderless>
      <Header.Heading>
        {title ? (
          <Header.Title>
            <H5>{title}</H5>
          </Header.Title>
        ) : null}
        {subtitle ? (
          <Header.Description>
            <Paragraph truncated microcopy>{subtitle}</Paragraph>
          </Header.Description>
        ) : null}
      </Header.Heading>
      <Header.Actions>
        <Icon name='filter_list' disabled />
      </Header.Actions>
    </Header>
    <Card.Content fullHeight>
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100% - 64px)'}}>
        {children}
      </div>
    </Card.Content>
  </Card>
)

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      ready: false,
      dashboards: {},
      metrics: {
        'live-calls': {
          value: 0
        },
        'live-users': {
          value: 0
        }
      },
      subscriptions: {},
      messages: {}
    }
  }

  componentDidMount() {
    this.prepare()
  }

  async prepare() {
    const dashboards = await getDashboards()
    const selectedDashboardId = Object.keys(dashboards)[0]
    const dashboardDefinition = await getDashboardDefinition(selectedDashboardId)

    const dashboardsWithDefinition = {
      ...dashboards,
      [selectedDashboardId]: {
        ...dashboards[selectedDashboardId],
        definition: dashboardDefinition
      }
    }

    this.setState(prevState => ({
      ...prevState,
      dashboards: dashboardsWithDefinition,
      selectedDashboardId
    }), () => {
      const metrics = this.getMetricsFromWidgets(dashboardDefinition.widgets)

      this.subscribeMetrics(metrics)
      this.setState(prevState => ({ ...prevState, ready: true }))
    })
  }

  subscribeMetrics(metrics) {
    const { subscriptions } = this.state
    const updatedSubscriptions = metrics.reduce((subs, metricId) => {
      const currentSubscription = subscriptions[metricId]

      // Reuse previous subscription instead of creating a new one
      if (currentSubscription) {
        return { ...subs, [metricId]: currentSubscription }
      }

      const source = new EventSource(`${API_URL}/subscribe/${metricId}`)
      console.log('The event source was initialized:', source.url, source.readyState)

      source.onmessage = event => this.updateMetric(metricId, event.data)
      source.onerror = () => {
        console.error('There was an error with the event source:', source.url, source.readyState)
        this.setState(prevState => ({
          ...prevState,
          messages: {
            ...prevState.messages,
            [source.url]: {
              id: source.url,
              type: source.readyState === source.CLOSED ? 'danger' : 'warning',
              text: source.readyState === source.CLOSED
                ? 'The connection was unexpectedly closed. Please refresh the browser.'
                : 'The connection is a bit unstable.'
            }
          }
        }))
      }
      source.onopen = () => {
        console.log('The connection is open:', source.url, source.readyState)
        this.setState(prevState => ({
          ...prevState,
          messages: Object.keys(prevState.messages).reduce((acc, id) => id === source.url ? acc : { ...acc, [id]: prevState.messages[id] }, {})
        }))
      }


      return { ...subs, [metricId]: source }
    }, {})

    this.setState(prevState => ({ ...prevState, subscriptions: updatedSubscriptions }))
  }

  unsubscribeMetrics(newMetrics) {
    const { subscriptions } = this.state

    const updatedSubscriptions = Object.keys(subscriptions).reduce((subs, metricId) => {
      const subscription = subscriptions[metricId]

      if (newMetrics.includes(metricId)) {
        return { ...subs, [metricId]: subscription }
      }

      subscription.close()
      console.log('Closed event source:', subscription.url, subscription.readyState)

      return subs
    }, {})

    this.setState(prevState => ({ ...prevState, subscriptions: updatedSubscriptions }))
  }

  updateMetric(id, value) {
    this.setState(prevState => ({
      ...prevState,
      metrics: {
        ...prevState.metrics,
        [id]: { value }
      }
    }))
  }

  getMetricsFromWidgets(widgets) {
    const widgetMetrics = Object.values(widgets).map(w => w.metric)
    const metrics = [...new Set(widgetMetrics)]

    return metrics
  }

  selectDashboard = async (event) => {
    const dashboardId = event.target.value
    const dashboardDefinition = await getDashboardDefinition(dashboardId)

    this.setState(prevState => ({
      ...prevState,
      dashboards: {
        ...prevState.dashboards,
        [dashboardId]: {
          ...prevState.dashboards[dashboardId],
          definition: dashboardDefinition
        }
      },
      selectedDashboardId: dashboardId
    }), () => {
      const metrics = this.getMetricsFromWidgets(dashboardDefinition.widgets)

      this.unsubscribeMetrics(metrics)
      this.subscribeMetrics(metrics)
    })
  }

  render() {
    const { dashboards, metrics, selectedDashboardId, messages } = this.state
    const dashboard = dashboards[selectedDashboardId]

    return (
      <CobaltRoot>
        <div className={Color.background.gray[200]} style={{ display: 'flex', flex: 1 }}>
          <Page>
            <Header contained>
              <Header.Heading>
                <Header.Title>
                  <Dropdown
                    borderless
                    valueToSelection={value => <H1>{dashboards[value].name}</H1>}
                    onChange={this.selectDashboard}
                  >
                    {Object.values(dashboards).map(dashboard => (
                      <Dropdown.Option key={dashboard.id} value={dashboard.id} active={dashboard.id === selectedDashboardId}>
                        {dashboard.name}
                      </Dropdown.Option>
                    ))}
                  </Dropdown>
                </Header.Title>
              </Header.Heading>
              <Header.Actions>
                <Tooltip text='Settings' position='top center'>
                  <Button onClick={noop}><Icon name='settings' small /></Button>
                </Tooltip>
                <Tooltip text='Filters' position='top center'>
                  <Button onClick={noop}><Icon name='filter_list' small /></Button>
                </Tooltip>
                <Tooltip text='Edit Widgets' position='top center'>
                  <Button onClick={noop}><Icon name='edit' small /></Button>
                </Tooltip>
                <Divider vertical />
                <Button onClick={noop} primary>New Dashboard</Button>
              </Header.Actions>
            </Header>
            <Page.Content>
              <Grid>
                <Section>
                  <Section.Content noPadding>
                    {Object.values(messages).map(message => (
                      <Message id={message.id} danger={message.type === 'danger'} warning={message.type === 'warning'}>
                          {message.text}
                      </Message>
                    ))}
                  </Section.Content>
                </Section>
                <Section>
                  <Section.Content>
                    {this.state.ready ? (
                      <Dashboard definition={dashboard.definition}>
                        {Object.values(dashboard.definition.widgets).map(widget => (
                          <div key={widget.id}>
                            <Widget title={widget.title} subtitle={widget.subtitle}>
                              <Number>{metrics[widget.metric].value}</Number>
                            </Widget>
                          </div>
                        ))}
                      </Dashboard>
                    ) : <Loader />}
                  </Section.Content>
                </Section>
              </Grid>
            </Page.Content>
          </Page>
        </div>
      </CobaltRoot>
    );
  }
}

export default App;
