# Trailblaze Server API Documentation

## Index

1. [Route Endpoints](#route-endpoints)
     1. [Create Route (Graphhopper)](#create-route-graphhopper)
2. [User Endpoints](#user-endpoints)
     1. [Get User Profile](#get-user-profile)
     2. [Save User Profile](#save-user-route)
     3. [Delete User Route](#delete-user-route)
3. [Middleware](#middleware)
4. [Example Request and Response](#example-request-and-response)
5. [General Error Codes](#general-error-codes)
6. [Notes](#notes)

## Base URL

https://api.trailblaze.cc


## Authentication

_Every Request to the API must be validated using a **secret client token**. This token is required to authenticate your requests and ensure secure access to the API._

_To obtain your client token for development purposes, please contact us at: [development@trailblaze.cc](mailto:development@trailblaze.cc)._

Example header:
```
TRAILBLAZE-APP-TOKEN: <token>
```


# v1

## Route Endpoints

1. ### Create Route (Graphhopper)

    URL: https://api.trailblaze.cc/v1/routes/create-route-graphhopper

    Method: `GET`

    JWT Required: No

    **Description**:
    Creates a route using the Graphhopper API based on provided waypoints and profile.

    #### Request Body:

    - profile: The routing profile (e.g., ```walking, cycling, gravel_cycling```).

    - waypoints: An array of JSON coordinates.

    #### Response Codes:

    -  ```200 OK```: Returns the route details.

    -   ```406 Not Acceptable```: If a requested point is outside the allowed range.

    -   ```422 Unprocessable Entity```: If requested points are too far apart.

    -   ```500 Internal Server Error```: If an error occurs while fetching the route.

## User Endpoints

1. ### Get User Profile

    URL: https://api.trailblaze.cc/v1/users
    
    Method: ```GET```
    
    JWT Required: Yes

    Description: Fetches the user profile based on the decoded JWT token. If the user doesn't exist, a new profile is created.

    **Request**:
    - Headers:

        - ```Authorization: Bearer <token>``` (JWT token required in the ```Authorization``` header)

    **Response**:

    - **Success**:

        -   ```200 OK``` with the user profile data if the user exists.
        
        - ```201 Created``` if a new user profile is created.

    - **Failure**:

        - ```401 Unauthorized``` if JWT token is invalid or expired.
            
        - ```500 Internal Server Error``` if something goes wrong on the server side.

2. ### Save User Route

    URL: https://api.trailblaze.cc/v1/users/routes

    Method: ```POST```

    JWT Required: Yes

    Description: Saves a new route for a user. The route data is sent in the request body.

    **Request**:
    - URL Params:
    - userId: The user’s ID for whom the route is being saved.

    - **Headers**:

        ```Authorization: Bearer <token>``` (JWT token required in the ```Authorization``` header)

    **Body**:

    - The route data to be saved (in JSON format), including:

        - ```title```: The title of the route (max length enforced).

        - ```route```: The actual route data.

        - ```imageUrl```: A static map image URL.

        - ```routeOptions```: Additional options for the route.

    **Response**:
    - Success:
        
        - ```201 Created``` if the route is successfully saved, with the route ID returned.

    - Failure:
        
        - ```400 Bad Request``` if the input data is invalid (e.g., missing image URL or title is too long).
        
        - ```401 Unauthorized``` if the JWT token is invalid or expired.
        
        - ```404 Not Found``` if the user cannot be found.
        
        - ```500 Internal Server Error``` if something goes wrong on the server side.

3. ### Delete User Route

    URL: https://api.trailblaze.cc/users/routes/:routeId

    Method: ```DELETE```

    JWT Required: Yes

    Description: Deletes an existing route for a user by routeId.

    **Request**:
    - URL Params:

        - ```userId```: The user’s ID whose route is being deleted.

        - ```routeId```: The ID of the route to delete.

    - **Headers**:

        - ```Authorization: Bearer <token>``` (JWT token required in the ```Authorization``` header)

    **Response**:

    - **Success**:

        - ```204 No Content``` if the route is successfully deleted.

    - **Failure**:

        -   ```401 Unauthorized``` if the JWT token is invalid or expired.
        -   ```403 Forbidden``` if the user is unauthorized to delete the route.
        - ```404 Not Found``` if the route or user does not exist.
        - ```500 Internal Server Error``` if something goes wrong on the server side.

## Middleware

### App Token Middleware

This middleware validates that a request is coming from an authorized client. The app token must be passed in the header of __every request__ to the API.

### JwtAuth Middleware

This middleware validates the JWT token passed in the Authorization header for each of the endpoints. If the token is valid, the request proceeds to the route handler. Otherwise, it returns a 401 Unauthorized response.

## Example Request and Response

### Create Route (Graphhopper)

#### Request:
- GET ```https://api.trailblaze.cc/v1/routes/create-route-graphhopper``` 

    Header: 
    ```
    TRAILBLAZE-APP-TOKEN: <secret_token>
    ```

**Response**:

```
{
	"title" : string,
	"type" : string,
	"route" : {
		"distance" : float,
		"weight" : float,
		"time" : long,
		"points_encoded" : bool,
		"bbox" : [],
		"points" : "<encoded points>",
		"instructions" : [],
		"legs" : [ ],
		"details" : {
			"surface" : [],
			"leg_distance" : [],
			"road_class" : []
		},
		"ascend" : float,
		"descend" : float,
	},
	"imageUrl" : "<Mapbox encoded route style url>",
	"routeOptions" : {
		"profile" : "gravel_cycling",
		"waypoints" : []
	},
}
```

### Get User Profile

#### Request:
- GET ```https://api.trailblaze.cc/v1/users``` 

    Header: 
    ```
    TRAILBLAZE-APP-TOKEN: <secret_token>
    Authorization: Bearer <your_jwt_token>
    ```
#### Response:

```
{
  "email": "user123@email.com",
  "username": "user123",
  "user_sub": "google-oauth2|id12345",
  "routes": [
    {
      "$oid": "someRouteId"
    }
  ],
  "profile_picture": "<byte data>"
}
```


## General Error Codes

```400 Bad Request```: Invalid request parameters or body content.

```401 Unauthorized```: Invalid or missing JWT token.

```403 Forbidden```: Unauthorized action (e.g., trying to delete a route not belonging to the user).

```404 Not Found```: The requested resource could not be found (e.g., user or route does not exist).

```500 Internal Server Error```: Server encountered an unexpected error.

## Notes
- Ensure that the ```Authorization``` header is included with the ```Bearer <token>``` format for each user-related request.

- Client must handle token expiration and renew tokens as necessary.

