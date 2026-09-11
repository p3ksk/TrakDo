# Build from the repository root:
#   podman build -f TrakDo.API/Dockerfile -t trakdo-api .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore against the project file alone so this layer survives source edits.
COPY TrakDo.API/TrakDo.API.csproj TrakDo.API/
RUN dotnet restore TrakDo.API/TrakDo.API.csproj

COPY TrakDo.API/ TrakDo.API/
RUN dotnet publish TrakDo.API/TrakDo.API.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

USER app

ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 8080
ENTRYPOINT ["dotnet", "TrakDo.API.dll"]
