@echo off
setlocal

REM Define variables
set IMAGE_NAME=hbgames/ronaldburns-portfolio

echo Logging into Docker Hub...
docker login
IF %ERRORLEVEL% NEQ 0 (
    echo Docker login failed. Please ensure your credentials are correct.
    exit /b 1
)

echo Building the Docker image: %IMAGE_NAME%
docker build -t %IMAGE_NAME% .
IF %ERRORLEVEL% NEQ 0 (
    echo Docker build failed. Please check the Dockerfile and your build context.
    exit /b 1
)

echo Pushing the image to Docker Hub...
docker push %IMAGE_NAME%
IF %ERRORLEVEL% NEQ 0 (
    echo Docker push failed. Please check if you have permission to push to this repository.
    exit /b 1
)

echo Successfully built and pushed %IMAGE_NAME%.
endlocal