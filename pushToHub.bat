npm install && ^
npm run convex:dev -- --once && ^
npx convex deploy && ^
docker build --platform linux/amd64,linux/arm64 -t docker.io/dirtbikerxz/venom-parts:latest . && ^
docker push docker.io/dirtbikerxz/venom-parts:latest