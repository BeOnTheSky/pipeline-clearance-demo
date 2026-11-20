FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM maven:3.9.11-eclipse-temurin-17 AS backend
WORKDIR /build/backend
COPY backend/pom.xml ./
COPY backend/src ./src
COPY --from=frontend /build/frontend/dist ./src/main/resources/static
RUN --mount=type=cache,target=/root/.m2 mvn -B package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=backend /build/backend/target/app.jar ./app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

