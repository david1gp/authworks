import { Route, Router } from "@solidjs/router"
import { AdminDemoApp } from "../features/admin/ui/AdminDemoApp.js"
import { DemoHub } from "../features/demo/ui/DemoHub.js"
import { EventList } from "../features/events/ui/EventList.js"
import { LoginDemoApp } from "../features/login/ui/LoginDemoApp.js"
import { OrganizationDetail } from "../features/organizations/ui/OrganizationDetail.js"
import { OrganizationList } from "../features/organizations/ui/OrganizationList.js"
import { ProjectDetail } from "../features/projects/ui/ProjectDetail.js"
import { ProjectList } from "../features/projects/ui/ProjectList.js"
import { UserDetail } from "../features/users/ui/UserDetail.js"
import { UserList } from "../features/users/ui/UserList.js"

export function UiRouter() {
  return (
    <Router>
      <Route path="/" component={DemoHub} />
      <Route path="/demo" component={DemoHub} />
      <Route path="/demo/login" component={LoginDemoApp} />
      <Route path="/demo/login/*loginPath" component={LoginDemoApp} />
      <Route path="/demo/admin" component={AdminDemoApp}>
        <Route path="/" component={OrganizationList} />
        <Route path="/organizations" component={OrganizationList} />
        <Route path="/organizations/:organizationId" component={OrganizationDetail} />
        <Route path="/users" component={UserList} />
        <Route path="/users/:userId" component={UserDetail} />
        <Route path="/projects" component={ProjectList} />
        <Route path="/projects/:projectId" component={ProjectDetail} />
        <Route path="/events" component={EventList} />
      </Route>
    </Router>
  )
}
