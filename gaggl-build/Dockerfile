# Build environment for a local Podverse Next Android release build (FOSS flavour).
# Expo 58 / React Native 0.88: JDK 17, Node 24.15 (repo engines + eas.json base).
# The SDK components are baked in with sdkmanager, one cached layer each. Gradle's own SDK
# auto-download is switched off in the build (it stalled for 40 minutes on this network), so a
# missing component fails fast. Versions match react-native/gradle/libs.versions.toml for 0.88.
FROM eclipse-temurin:17-jdk-noble

ARG NODE_VERSION=24.15.0
ARG CMDLINE_TOOLS=11076708
# sdkmanager names platforms by minor version from 36.1 on: compileSdk 37 is "android-37.0"
ARG COMPILE_SDK=37.0
ARG BUILD_TOOLS=37.0.0
ARG NDK_VERSION=27.1.12297006
ARG CMAKE_VERSION=3.22.1

ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    DEBIAN_FRONTEND=noninteractive \
    # sdkmanager and Gradle's Java downloaders can stall indefinitely on IPv6
    JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true"
ENV PATH=/opt/node/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip git python3 make g++ rsync xz-utils \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz \
    | tar -xJ -C /opt \
 && mv /opt/node-v${NODE_VERSION}-linux-x64 /opt/node

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSL -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS}_latest.zip \
 && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
 && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm /tmp/tools.zip \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager --verbose "platform-tools"
RUN sdkmanager --verbose "platforms;android-${COMPILE_SDK}" "platforms;android-36"
RUN sdkmanager --verbose "build-tools;${BUILD_TOOLS}"
RUN sdkmanager --verbose "cmake;${CMAKE_VERSION}"
RUN sdkmanager --verbose "ndk;${NDK_VERSION}"

COPY build-in-container.sh /usr/local/bin/build-in-container.sh
RUN chmod +x /usr/local/bin/build-in-container.sh

WORKDIR /build
ENTRYPOINT ["/usr/local/bin/build-in-container.sh"]
