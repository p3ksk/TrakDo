# Build from the repository root:
#   podman build -f backend/MyApp.Api/Dockerfile -t myapp-api .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore against the project file alone so this layer survives source edits.
COPY backend/MyApp.Api/MyApp.Api.csproj backend/MyApp.Api/
RUN dotnet restore backend/MyApp.Api/MyApp.Api.csproj

COPY backend/MyApp.Api/ backend/MyApp.Api/
RUN dotnet publish backend/MyApp.Api/MyApp.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

USER app

ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 8080
ENTRYPOINT ["dotnet", "MyApp.Api.dll"]
