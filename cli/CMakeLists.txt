cmake_minimum_required(VERSION 2.8)

project( firestep )

SET(PROJECT_VERSION_MAJOR 1)
SET(PROJECT_VERSION_MINOR 8)
set(PROJECT_VERSION_PATCH 0)
set(PROJECT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}.${PROJECT_VERSION_PATCH})

IF(WIN32)
  MESSAGE(STATUS "Detecting WINDOWS build")
  list(APPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}")
  # By default, do not warn when built on machines using only VS Express:
  IF(NOT DEFINED CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS_NO_WARNINGS)
    SET(CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS_NO_WARNINGS ON)
  ENDIF()
ELSE(WIN32)
  MESSAGE(STATUS "Detecting LINUX build")
  SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -DTEST -DCMAKE -fPIC -g -Wno-format-extra-args")
  SET(CMAKE_SHARED_LINKER_FLAGS_DEBUG "${CMAKE_SHARED_LINKER_FLAGS_DEBUG} -g")
ENDIF(WIN32)

SET(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH}
    "${CMAKE_SOURCE_DIR}/cmake/Modules/")

add_definitions ("-Wall")
SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -D_FILE_OFFSET_BITS=64")

get_property(dirs DIRECTORY . PROPERTY INCLUDE_DIRECTORIES)
message("INCLUDE_DIRECTORIES:${dirs}")

SET(BUILD_TARGET_DIR "${CMAKE_CURRENT_SOURCE_DIR}/target" CACHE STRING "Put all binary output in target")
SET(EXECUTABLE_OUTPUT_PATH "${BUILD_TARGET_DIR}")
SET(RUNTIME_OUTPUT_NAME firestep)
SET(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)

include_directories( 
	${PROJECT_SOURCE_DIR}/FireStep
	${BUILD_TARGET_DIR} 
	${PROJECT_SOURCE_DIR}/src
	${PROJECT_SOURCE_DIR}/ArduinoJson/include 
	${PROJECT_SOURCE_DIR}/ph5
	/usr/local/include 
	/usr/include
)

include (InstallRequiredSystemLibraries)
SET(CPACK_RESOURCE_FILE_LICENSE  
     "${CMAKE_CURRENT_SOURCE_DIR}/../LICENSE")
SET(CPACK_PACKAGE_GENERATED_WARNING "GENERATED FILE!!! DO NOT CHANGE!!!")
SET(CPACK_PACKAGE_VERSION_MAJOR "${PROJECT_VERSION_MAJOR}")
SET(CPACK_PACKAGE_VERSION_MINOR "${PROJECT_VERSION_MINOR}")
include (CPack)

get_property(dirs DIRECTORY . PROPERTY INCLUDE_DIRECTORIES)
message("INCLUDE_DIRECTORIES:")
foreach(dir ${dirs})
  message(STATUS "  dir='${dir}'")
endforeach()

configure_file (
  "${PROJECT_SOURCE_DIR}/src/version.h.in"
  "${BUILD_TARGET_DIR}/version.h"
  )

message("CMAKE_PREFIX_PATH:${CMAKE_PREFIX_PATH}")

link_directories( 
	${BUILD_TARGET_DIR} 
	/usr/lib 
	/usr/local/lib 
)

########## firestep: command line client ################
add_executable(firestep 
	src/FireLog.cpp
	src/ArduinoUSB.cpp
	src/FireStepSerial.cpp
	src/FireStepClient.cpp
	src/firestep.cpp
)


set(FIRESTEP_INSTALL_LIB_DIR		lib CACHE PATH "Installation directory for libraries")
set(FIRESTEP_INSTALL_BIN_DIR		bin CACHE PATH "Installation directory for executable")
set(FIRESTEP_INSTALL_INCLUDE_DIR	include CACHE PATH "Installation directory for header files")

INSTALL(TARGETS firestep DESTINATION ${FIRESTEP_INSTALL_BIN_DIR})
