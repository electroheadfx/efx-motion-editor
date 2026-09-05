# Deferred Items — quick 260905-f3v

Out-of-scope discoveries logged during execution (scope boundary rule).

| Item | Found during | Description | Status |
|------|--------------|-------------|--------|
| Delete/Refresh descriptionId gap | Task 1 | The Delete Action and Refresh Actions toolbar buttons route through the shared IconButton helper with `disabledReason` but no `descriptionId` prop (pre-existing from quick 260905-dso). When disabled, the sr-only reason span and `aria-describedby` are therefore absent for these two buttons — the styled tooltip still shows the reason, so the plan's must-have truth is met, but the screen-reader announcement path is incomplete. The plan's context note claimed all five buttons carry `descriptionId`; the code does not. Not fixed in Task 1 because the plan explicitly forbids production-code changes there. | open |
