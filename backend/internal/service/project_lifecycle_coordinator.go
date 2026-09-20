package service

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
)

var errProjectDeletionInProgress = errors.New("project deletion is in progress")
var errUserDeletionInProgress = errors.New("user deletion is in progress")

type userLifecycleGate struct {
	mu       sync.Mutex
	deleting bool
	active   int
	idle     chan struct{}
}

func newUserLifecycleGate() *userLifecycleGate {
	idle := make(chan struct{})
	close(idle)
	return &userLifecycleGate{idle: idle}
}

type projectLifecycleGate struct {
	mu                 sync.Mutex
	operation          chan struct{}
	deleting           bool
	asyncDeletion      bool
	deletionGeneration uint64
	active             int
	idle               chan struct{}
}

func newProjectLifecycleGate() *projectLifecycleGate {
	idle := make(chan struct{})
	close(idle)
	operation := make(chan struct{}, 1)
	operation <- struct{}{}
	return &projectLifecycleGate{
		operation: operation,
		idle:      idle,
	}
}

type activeProjectActivity struct {
	cancel             context.CancelFunc
	generation         bool
	deletionGeneration uint64
}

type projectDeletionLease struct {
	gate       *projectLifecycleGate
	generation uint64
}

// ProjectLifecycleCoordinator serializes user-level project creation/deletion
// and prevents project mutations from crossing an administrator deletion.
type ProjectLifecycleCoordinator struct {
	userLocks        sync.Map
	projectGates     sync.Map
	activityMu       sync.Mutex
	activeActivities map[string]map[*activeProjectActivity]struct{}
	userActivities   map[string]map[*activeProjectActivity]struct{}
}

func NewProjectLifecycleCoordinator() *ProjectLifecycleCoordinator {
	return &ProjectLifecycleCoordinator{
		activeActivities: make(map[string]map[*activeProjectActivity]struct{}),
		userActivities:   make(map[string]map[*activeProjectActivity]struct{}),
	}
}

func (c *ProjectLifecycleCoordinator) userGate(userID string) *userLifecycleGate {
	value, _ := c.userLocks.LoadOrStore(strings.TrimSpace(userID), newUserLifecycleGate())
	return value.(*userLifecycleGate)
}

func (c *ProjectLifecycleCoordinator) acquireUserOperation(userID string) (func(), error) {
	if c == nil || strings.TrimSpace(userID) == "" {
		return func() {}, nil
	}
	gate := c.userGate(userID)
	gate.mu.Lock()
	defer gate.mu.Unlock()
	if gate.deleting {
		return nil, errUserDeletionInProgress
	}
	if gate.active == 0 {
		gate.idle = make(chan struct{})
	}
	gate.active++

	var once sync.Once
	return func() {
		once.Do(func() {
			gate.mu.Lock()
			defer gate.mu.Unlock()
			gate.active--
			if gate.active == 0 {
				close(gate.idle)
			}
		})
	}, nil
}

func (c *ProjectLifecycleCoordinator) beginUserDeletion(
	ctx context.Context,
	userID string,
) (func(bool), error) {
	idle, finish, err := c.startUserDeletion(userID)
	if err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		finish(false)
		return nil, ctx.Err()
	case <-idle:
		return finish, nil
	}
}

func (c *ProjectLifecycleCoordinator) startUserDeletion(
	userID string,
) (<-chan struct{}, func(bool), error) {
	if c == nil || strings.TrimSpace(userID) == "" {
		idle := make(chan struct{})
		close(idle)
		return idle, func(bool) {}, nil
	}
	userID = strings.TrimSpace(userID)
	gate := c.userGate(userID)
	gate.mu.Lock()
	if gate.deleting {
		gate.mu.Unlock()
		return nil, nil, errUserDeletionInProgress
	}
	gate.deleting = true
	idle := gate.idle
	gate.mu.Unlock()

	c.cancelUserActivities(userID)

	var once sync.Once
	return idle, func(committed bool) {
		once.Do(func() {
			gate.mu.Lock()
			if !committed {
				gate.deleting = false
			}
			gate.mu.Unlock()
		})
	}, nil
}

func (c *ProjectLifecycleCoordinator) projectGate(projectID string) *projectLifecycleGate {
	value, _ := c.projectGates.LoadOrStore(strings.TrimSpace(projectID), newProjectLifecycleGate())
	return value.(*projectLifecycleGate)
}

func (c *ProjectLifecycleCoordinator) acquireProjectMutation(projectID string) (func(), error) {
	return c.acquireProjectMutationContext(context.Background(), projectID)
}

func (c *ProjectLifecycleCoordinator) acquireProjectMutationContext(
	ctx context.Context,
	projectID string,
) (func(), error) {
	if c == nil || strings.TrimSpace(projectID) == "" {
		return func() {}, nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	gate := c.projectGate(projectID)
	gate.mu.Lock()
	if gate.deleting {
		gate.mu.Unlock()
		return nil, errProjectDeletionInProgress
	}
	if gate.active == 0 {
		gate.idle = make(chan struct{})
	}
	gate.active++
	gate.mu.Unlock()

	select {
	case <-ctx.Done():
		c.finishProjectMutation(gate)
		return nil, ctx.Err()
	case <-gate.operation:
		if err := ctx.Err(); err != nil {
			gate.operation <- struct{}{}
			c.finishProjectMutation(gate)
			return nil, err
		}
	}

	var once sync.Once
	return func() {
		once.Do(func() {
			gate.operation <- struct{}{}
			c.finishProjectMutation(gate)
		})
	}, nil
}

func (c *ProjectLifecycleCoordinator) beginCancellableUserProjectMutation(
	ctx context.Context,
	userID string,
	projectID string,
	generation bool,
) (context.Context, func(), error) {
	if c == nil {
		return ctx, func() {}, nil
	}
	finishUserOperation, err := c.acquireUserOperation(userID)
	if err != nil {
		return ctx, nil, err
	}
	operationCtx, cancel := context.WithCancel(safeContext(ctx))
	unregister := c.registerUserProjectActivity(
		userID,
		projectID,
		cancel,
		generation,
	)
	finishMutation, err := c.acquireProjectMutationContext(
		operationCtx,
		projectID,
	)
	if err != nil {
		cancel()
		unregister()
		finishUserOperation()
		return ctx, nil, err
	}
	var once sync.Once
	return operationCtx, func() {
		once.Do(func() {
			cancel()
			unregister()
			finishMutation()
			finishUserOperation()
		})
	}, nil
}

func (c *ProjectLifecycleCoordinator) finishProjectMutation(gate *projectLifecycleGate) {
	gate.mu.Lock()
	defer gate.mu.Unlock()
	gate.active--
	if gate.active == 0 {
		close(gate.idle)
	}
}

func (c *ProjectLifecycleCoordinator) beginProjectDeletion(
	ctx context.Context,
	projectIDs []string,
) (func(bool), []string, error) {
	if c == nil {
		return func(bool) {}, nil, nil
	}

	normalized := make([]string, 0, len(projectIDs))
	seen := make(map[string]struct{}, len(projectIDs))
	for _, projectID := range projectIDs {
		projectID = strings.TrimSpace(projectID)
		if projectID == "" {
			continue
		}
		if _, exists := seen[projectID]; exists {
			continue
		}
		seen[projectID] = struct{}{}
		normalized = append(normalized, projectID)
	}
	sort.Strings(normalized)

	gates := make([]*projectLifecycleGate, 0, len(normalized))
	for _, projectID := range normalized {
		gates = append(gates, c.projectGate(projectID))
	}
	for _, gate := range gates {
		gate.mu.Lock()
	}
	var transferredAsync []string
	for index, gate := range gates {
		if gate.deleting && !gate.asyncDeletion {
			for i := len(gates) - 1; i >= 0; i-- {
				gates[i].mu.Unlock()
			}
			return nil, nil, errProjectDeletionInProgress
		}
		if gate.asyncDeletion {
			transferredAsync = append(transferredAsync, normalized[index])
		}
	}

	leases := make([]projectDeletionLease, 0, len(gates))
	idleChannels := make([]<-chan struct{}, 0, len(normalized))
	for _, gate := range gates {
		gate.deletionGeneration++
		gate.deleting = true
		gate.asyncDeletion = false
		leases = append(leases, projectDeletionLease{
			gate:       gate,
			generation: gate.deletionGeneration,
		})
		idle := gate.idle
		idleChannels = append(idleChannels, idle)
	}
	for i := len(gates) - 1; i >= 0; i-- {
		gates[i].mu.Unlock()
	}

	for _, projectID := range normalized {
		c.cancelProjectActivities(projectID, false)
	}

	var once sync.Once
	finishDeletion := func(committed bool) {
		once.Do(func() {
			c.finishProjectDeletion(leases, committed)
		})
	}
	for _, idle := range idleChannels {
		select {
		case <-ctx.Done():
			return finishDeletion, transferredAsync, ctx.Err()
		case <-idle:
		}
	}

	return finishDeletion, transferredAsync, nil
}

func (c *ProjectLifecycleCoordinator) finishProjectDeletion(
	leases []projectDeletionLease,
	committed bool,
) {
	for _, lease := range leases {
		gate := lease.gate
		gate.mu.Lock()
		if gate.deletionGeneration != lease.generation {
			gate.mu.Unlock()
			continue
		}
		if !committed {
			gate.deleting = false
		}
		gate.asyncDeletion = false
		gate.mu.Unlock()
	}
}

func (c *ProjectLifecycleCoordinator) preserveProjectDeletionBarriers(
	projectIDs []string,
) map[string]uint64 {
	preserved := make(map[string]uint64)
	if c == nil {
		return preserved
	}
	normalized := make([]string, 0, len(projectIDs))
	seen := make(map[string]struct{}, len(projectIDs))
	for _, projectID := range projectIDs {
		projectID = strings.TrimSpace(projectID)
		if projectID == "" {
			continue
		}
		if _, exists := seen[projectID]; exists {
			continue
		}
		seen[projectID] = struct{}{}
		normalized = append(normalized, projectID)
	}
	sort.Strings(normalized)

	gates := make([]*projectLifecycleGate, 0, len(normalized))
	for _, projectID := range normalized {
		gate := c.projectGate(projectID)
		gate.mu.Lock()
		gates = append(gates, gate)
	}
	for index, gate := range gates {
		gate.deletionGeneration++
		gate.deleting = true
		preserved[normalized[index]] = gate.deletionGeneration
		gate.asyncDeletion = false
	}
	for i := len(gates) - 1; i >= 0; i-- {
		gates[i].mu.Unlock()
	}
	return preserved
}

func (c *ProjectLifecycleCoordinator) releasePreservedProjectDeletionBarrier(
	projectID string,
	generation uint64,
) {
	if c == nil || strings.TrimSpace(projectID) == "" || generation == 0 {
		return
	}
	gate := c.projectGate(projectID)
	gate.mu.Lock()
	defer gate.mu.Unlock()
	if gate.deletionGeneration != generation {
		return
	}
	gate.deleting = false
	gate.asyncDeletion = false
}

func (c *ProjectLifecycleCoordinator) beginAsyncProjectDeletion(
	ctx context.Context,
	projectID string,
	cancel context.CancelFunc,
) (func(), func(bool), func() bool, func(), error) {
	if c == nil || strings.TrimSpace(projectID) == "" {
		return func() {}, func(bool) {}, func() bool { return true }, func() {}, nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	projectID = strings.TrimSpace(projectID)
	gate := c.projectGate(projectID)
	gate.mu.Lock()
	if gate.deleting {
		gate.mu.Unlock()
		return nil, nil, nil, nil, errProjectDeletionInProgress
	}
	gate.deletionGeneration++
	generation := gate.deletionGeneration
	gate.deleting = true
	gate.asyncDeletion = true
	idle := gate.idle
	gate.mu.Unlock()

	lease := projectDeletionLease{gate: gate, generation: generation}
	var finishOnce sync.Once
	finishDeletion := func(committed bool) {
		finishOnce.Do(func() {
			c.finishProjectDeletion([]projectDeletionLease{lease}, committed)
		})
	}
	markCleanupStarted := func() bool {
		gate.mu.Lock()
		defer gate.mu.Unlock()
		if !gate.deleting || !gate.asyncDeletion || gate.deletionGeneration != generation {
			return false
		}
		gate.asyncDeletion = false
		return true
	}

	unregister := c.registerProjectDeletionActivity(
		projectID,
		generation,
		cancel,
	)
	c.cancelProjectActivitiesExcept(projectID, false, generation)

	select {
	case <-ctx.Done():
		unregister()
		finishDeletion(false)
		return nil, nil, nil, nil, ctx.Err()
	case <-idle:
	}

	gate.mu.Lock()
	if !gate.deleting ||
		!gate.asyncDeletion ||
		gate.deletionGeneration != generation {
		gate.mu.Unlock()
		unregister()
		finishDeletion(false)
		return nil, nil, nil, nil, errProjectDeletionInProgress
	}
	if gate.active == 0 {
		gate.idle = make(chan struct{})
	}
	gate.active++
	gate.mu.Unlock()

	select {
	case <-ctx.Done():
		c.finishProjectMutation(gate)
		unregister()
		finishDeletion(false)
		return nil, nil, nil, nil, ctx.Err()
	case <-gate.operation:
		if err := ctx.Err(); err != nil {
			gate.operation <- struct{}{}
			c.finishProjectMutation(gate)
			unregister()
			finishDeletion(false)
			return nil, nil, nil, nil, err
		}
	}

	var releaseOnce sync.Once
	releaseMutation := func() {
		releaseOnce.Do(func() {
			gate.operation <- struct{}{}
			c.finishProjectMutation(gate)
		})
	}
	return releaseMutation, finishDeletion, markCleanupStarted, unregister, nil
}

func (c *ProjectLifecycleCoordinator) registerGeneration(
	projectID string,
	cancel context.CancelFunc,
) func() {
	return c.registerUserProjectActivityWithDeletion(
		"",
		projectID,
		cancel,
		true,
		0,
	)
}

func (c *ProjectLifecycleCoordinator) registerProjectActivity(
	projectID string,
	cancel context.CancelFunc,
	generation bool,
) func() {
	return c.registerUserProjectActivityWithDeletion(
		"",
		projectID,
		cancel,
		generation,
		0,
	)
}

func (c *ProjectLifecycleCoordinator) registerUserProjectActivity(
	userID string,
	projectID string,
	cancel context.CancelFunc,
	generation bool,
) func() {
	return c.registerUserProjectActivityWithDeletion(
		userID,
		projectID,
		cancel,
		generation,
		0,
	)
}

func (c *ProjectLifecycleCoordinator) registerProjectDeletionActivity(
	projectID string,
	deletionGeneration uint64,
	cancel context.CancelFunc,
) func() {
	return c.registerUserProjectActivityWithDeletion(
		"",
		projectID,
		cancel,
		false,
		deletionGeneration,
	)
}

func (c *ProjectLifecycleCoordinator) registerUserProjectActivityWithDeletion(
	userID string,
	projectID string,
	cancel context.CancelFunc,
	generation bool,
	deletionGeneration uint64,
) func() {
	if c == nil || cancel == nil {
		return func() {}
	}
	userID = strings.TrimSpace(userID)
	projectID = strings.TrimSpace(projectID)
	if userID == "" && projectID == "" {
		return func() {}
	}
	activity := &activeProjectActivity{
		cancel:             cancel,
		generation:         generation,
		deletionGeneration: deletionGeneration,
	}

	c.activityMu.Lock()
	existingGenerations := make([]*activeProjectActivity, 0, len(c.activeActivities[projectID]))
	if projectID != "" {
		for current := range c.activeActivities[projectID] {
			if generation && current.generation {
				existingGenerations = append(existingGenerations, current)
			}
		}
		if c.activeActivities[projectID] == nil {
			c.activeActivities[projectID] = make(map[*activeProjectActivity]struct{})
		}
		c.activeActivities[projectID][activity] = struct{}{}
	}
	if userID != "" {
		if c.userActivities[userID] == nil {
			c.userActivities[userID] = make(map[*activeProjectActivity]struct{})
		}
		c.userActivities[userID][activity] = struct{}{}
	}
	c.activityMu.Unlock()

	for _, current := range existingGenerations {
		current.cancel()
	}
	projectDeletionInvalid := deletionGeneration == 0 &&
		c.projectDeletionStarted(projectID)
	if deletionGeneration != 0 {
		projectDeletionInvalid = !c.ownsAsyncProjectDeletion(
			projectID,
			deletionGeneration,
		)
	}
	if projectDeletionInvalid || c.userDeletionStarted(userID) {
		cancel()
	}

	var once sync.Once
	return func() {
		once.Do(func() {
			c.activityMu.Lock()
			if projectID != "" {
				delete(c.activeActivities[projectID], activity)
				if len(c.activeActivities[projectID]) == 0 {
					delete(c.activeActivities, projectID)
				}
			}
			if userID != "" {
				delete(c.userActivities[userID], activity)
				if len(c.userActivities[userID]) == 0 {
					delete(c.userActivities, userID)
				}
			}
			c.activityMu.Unlock()
		})
	}
}

func (c *ProjectLifecycleCoordinator) projectDeletionStarted(projectID string) bool {
	if strings.TrimSpace(projectID) == "" {
		return false
	}
	gate := c.projectGate(projectID)
	gate.mu.Lock()
	defer gate.mu.Unlock()
	return gate.deleting
}

func (c *ProjectLifecycleCoordinator) ownsAsyncProjectDeletion(
	projectID string,
	generation uint64,
) bool {
	if strings.TrimSpace(projectID) == "" || generation == 0 {
		return false
	}
	gate := c.projectGate(projectID)
	gate.mu.Lock()
	defer gate.mu.Unlock()
	return gate.deleting &&
		gate.asyncDeletion &&
		gate.deletionGeneration == generation
}

func (c *ProjectLifecycleCoordinator) userDeletionStarted(userID string) bool {
	if strings.TrimSpace(userID) == "" {
		return false
	}
	gate := c.userGate(userID)
	gate.mu.Lock()
	defer gate.mu.Unlock()
	return gate.deleting
}

func (c *ProjectLifecycleCoordinator) cancelProjectGenerations(projectID string) bool {
	return c.cancelProjectActivities(projectID, true)
}

func (c *ProjectLifecycleCoordinator) cancelProjectActivities(
	projectID string,
	generationOnly bool,
) bool {
	return c.cancelProjectActivitiesExcept(projectID, generationOnly, 0)
}

func (c *ProjectLifecycleCoordinator) cancelProjectActivitiesExcept(
	projectID string,
	generationOnly bool,
	preservedDeletionGeneration uint64,
) bool {
	if c == nil || strings.TrimSpace(projectID) == "" {
		return false
	}
	c.activityMu.Lock()
	activities := make([]*activeProjectActivity, 0, len(c.activeActivities[projectID]))
	for activity := range c.activeActivities[projectID] {
		if generationOnly && !activity.generation {
			continue
		}
		if preservedDeletionGeneration != 0 &&
			activity.deletionGeneration == preservedDeletionGeneration {
			continue
		}
		activities = append(activities, activity)
	}
	c.activityMu.Unlock()
	for _, activity := range activities {
		activity.cancel()
	}
	return len(activities) > 0
}

func (c *ProjectLifecycleCoordinator) cancelUserActivities(userID string) bool {
	if c == nil || strings.TrimSpace(userID) == "" {
		return false
	}
	c.activityMu.Lock()
	activities := make([]*activeProjectActivity, 0, len(c.userActivities[userID]))
	for activity := range c.userActivities[userID] {
		activities = append(activities, activity)
	}
	c.activityMu.Unlock()
	for _, activity := range activities {
		activity.cancel()
	}
	return len(activities) > 0
}

func (c *ProjectLifecycleCoordinator) isGenerationActive(projectID string) bool {
	if c == nil || strings.TrimSpace(projectID) == "" {
		return false
	}
	c.activityMu.Lock()
	defer c.activityMu.Unlock()
	for activity := range c.activeActivities[strings.TrimSpace(projectID)] {
		if activity.generation {
			return true
		}
	}
	return false
}
