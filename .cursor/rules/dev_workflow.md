# ShopValue Development Workflow Rules

## Project Overview
ShopValue is a Romanian price tracking SaaS application that monitors product prices from Flip.ro and other e-commerce platforms. The application is built with Next.js 14, TypeScript, and MongoDB.

## Task Management System
- Tasks are defined in `tasks.json` in the project root
- Each task has an ID, title, description, status, priority, dependencies, and subtasks
- Follow the task structure and update status when completing tasks
- Dependencies must be completed before starting dependent tasks

## Development Guidelines

### 1. Code Quality Standards
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write comprehensive tests for all new features
- Use proper error handling and logging
- Follow Next.js 14 best practices with App Router

### 2. Architecture Patterns
- Use server components by default, client components only when needed
- Implement proper data fetching patterns with React Server Components
- Use Zod for input validation
- Implement proper error boundaries
- Follow the established folder structure

### 3. Database Guidelines
- Use Mongoose for MongoDB operations
- Implement proper indexing for performance
- Add data validation at the schema level
- Use transactions for multi-document operations
- Implement proper connection pooling

### 4. API Development
- Follow RESTful API conventions
- Implement proper authentication and authorization
- Use middleware for cross-cutting concerns
- Add comprehensive input validation
- Implement rate limiting and security headers

### 5. Security Requirements
- Never expose sensitive data in client-side code
- Implement proper authentication flows
- Use HTTPS for all external communications
- Validate and sanitize all user inputs
- Implement proper session management

### 6. Performance Optimization
- Implement caching strategies (Redis, Next.js cache)
- Optimize database queries
- Use proper image optimization
- Implement lazy loading where appropriate
- Monitor and optimize bundle sizes

### 7. Testing Standards
- Write unit tests for utilities and business logic
- Write integration tests for API endpoints
- Write E2E tests for critical user flows
- Maintain test coverage above 80%
- Use proper mocking strategies

## Task Implementation Process

### When Starting a Task:
1. Review task dependencies and ensure they are completed
2. Understand the task requirements and acceptance criteria
3. Create a plan for implementation
4. Set up necessary dependencies and configurations
5. Implement the feature following the guidelines above
6. Write comprehensive tests
7. Update documentation if needed
8. Update task status to "done" when complete

### Task 1.4 Specific Guidelines:
- Implement WebSocket using Socket.IO
- Ensure proper connection management and reconnection logic
- Add real-time price update notifications
- Implement proper error handling for WebSocket connections
- Test connection stability and message delivery
- Follow security best practices for WebSocket connections

## File Organization
```
├── app/                    # Next.js App Router
├── components/            # React components
├── lib/                   # Utilities and services
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
├── __tests__/             # Test files
├── public/                # Static assets
└── docs/                  # Documentation
```

## Commit Guidelines
- Use conventional commits format
- Include task ID in commit messages
- Write clear, descriptive commit messages
- Keep commits focused and atomic

## Before Creating PR
1. Run all tests and ensure they pass
2. Run `npm run build` to ensure production build works
3. Update task status in tasks.json
4. Add proper documentation for new features
5. Ensure code follows all guidelines above