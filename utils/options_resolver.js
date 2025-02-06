const CustomModelGravelCycling = require("../custom_routing/bike_gravel.json");
const CustomModelGravelCyclingRoundTrip = require("../custom_routing/bike_gravel_round_trip.json");
const CustomModelNormalCycling = require("../custom_routing/bike_normal.json");
const CustomModelNormalCyclingRoundTrip = require("../custom_routing/bike_normal_round_trip.json");
const CustomModelWalk = require("../custom_routing/walk.json");
const CustomModelWalkRoundTrip = require("../custom_routing/walk_round_trip.json");

class OptionsResolver {
  constructor(parsedData, waypoints) {
    this.parsedData = parsedData;
    this.waypoints = waypoints;
    this.options = null;
    this.isRoundTrip = parsedData.mode === "round_trip";
    this.defaultGeometry = { type: "Polygon", bbox: null, coordinates: [[]] };
  }

  resolveOptions() {
    this.options = this.isRoundTrip
      ? this.getOptionsRoundTrip(this.waypoints, this.parsedData.distance)
      : this.getOptions(this.waypoints);

    this.setProfileAndModel();
    this.setDistanceInfluence();
    this.setGeometry();

    return this.options;
  }

  setProfileAndModel() {
    const { profile } = this.parsedData;

    switch (profile) {
      case "cycling":
        this.options.profile = "bike_gravel";
        this.options.custom_model = this.isRoundTrip
          ? CustomModelNormalCyclingRoundTrip
          : CustomModelNormalCycling;
        break;
      case "gravel_cycling":
        this.options.profile = "bike_gravel";
        this.options.custom_model = this.isRoundTrip
          ? CustomModelGravelCyclingRoundTrip
          : CustomModelGravelCycling;
        break;
      case "walking":
        this.options.profile = "foot";
        this.options.custom_model = this.isRoundTrip
          ? CustomModelWalkRoundTrip
          : CustomModelWalk;
        break;
      default:
        throw new Error(`Unknown profile: ${profile}`);
    }
  }

  setDistanceInfluence() {
    if (!this.isRoundTrip) {
      this.options.custom_model.distance_influence =
        this.parsedData.influence ?? 1000000;
    }
  }

  setGeometry() {
    if (!this.isRoundTrip) {
      this.options.custom_model.areas.features[0].geometry =
        this.parsedData.ignore_area || this.defaultGeometry;
    } else {
      this.options.custom_model.areas.features[0].geometry =
        this.defaultGeometry;
    }
  }

  getOptions(waypoints) {
    return {
      points: waypoints,
      snap_preventions: ["motorway", "ferry", "tunnel"],
      details: ["road_class", "surface", "leg_distance", "leg_time"],
      locale: "en",
      instructions: true,
      calc_points: true,
      elevation: true,
      optimize: false,
      debug: false,
      points_encoded: true,
      algorithm: "alternative_route", //astarbi round_trip alternative_route
      "ch.disable": "false",
      "alternative_route.max_paths": 2,
      "alternative_route.max_weight_factor": 3.5,
      "alternative_route.max_share_factor": 1.4,
    };
  }

  getOptionsRoundTrip(waypoints, distance) {
    // Integer seed to randomize calculation.
    let seed = Math.floor(Math.random() * 1000);
    return {
      points: waypoints,
      snap_preventions: [
        'motorway',
        'ferry',
        'tunnel'
      ],
      // profile: 'bike_gravel',
      details: ['road_class', 'surface', 'leg_distance', 'leg_time'],
      locale: 'en',
      instructions: true,
      calc_points: true,
      elevation: true,
      optimize: false,
      debug: false,
      points_encoded: true,
      algorithm: 'round_trip',
      'ch.disable': true,
      'round_trip.distance': distance,
      'round_trip.seed': seed,
    }
  }
}

module.exports = OptionsResolver;
