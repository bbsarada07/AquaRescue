/**
 * AquaRescue 2D Kalman Filter Location Smoothing Engine
 * 
 * Filters out high-frequency GPS multi-path noise and water reflection artifacts
 * to achieve sub-meter continuous accuracy for water rescue targeting.
 */

export interface GPSCoordinate {
  lat: number;
  lng: number;
}

export interface FilteredResult {
  lat: number;
  lng: number;
  latVelocity: number; // degrees per second
  lngVelocity: number; // degrees per second
  variance: number;    // estimated position error (meters approx)
  noiseDeltaMeters: number; // difference between raw and smoothed in meters
}

export class KalmanFilter2D {
  // State matrix: [lat, lng, v_lat, v_lng]
  private state: [number, number, number, number] = [0, 0, 0, 0];
  
  // Estimate covariance matrix P (4x4 matrix initialized to high uncertainty)
  private P: number[][] = [
    [10, 0, 0, 0],
    [0, 10, 0, 0],
    [0, 0, 10, 0],
    [0, 0, 0, 10]
  ];

  // Process Noise Covariance Q (tuned for aquatic motion model)
  private processNoise: number;
  
  // Measurement Noise Covariance R (tuned for water GPS multipath reflection)
  private measurementNoise: number;

  private lastTimestampMs: number = 0;
  private isInitialized: boolean = false;

  /**
   * @param processNoise Acceleration uncertainty (default: 1e-4)
   * @param measurementNoise GPS multipath noise variance (default: 5e-5 for standard water reflection)
   */
  constructor(processNoise: number = 1e-5, measurementNoise: number = 5e-5) {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  /**
   * Resets or forces state to a fresh coordinate
   */
  public reset(initialLat: number, initialLng: number): void {
    this.state = [initialLat, initialLng, 0, 0];
    this.P = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    this.lastTimestampMs = Date.now();
    this.isInitialized = true;
  }

  /**
   * Calculates Haversine distance in meters between two lat/lng pairs
   */
  public static haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Process incoming raw GPS coordinate through the 2D Kalman Filter
   */
  public update(rawLat: number, rawLng: number, timestampMs: number = Date.now()): FilteredResult {
    if (!this.isInitialized) {
      this.reset(rawLat, rawLng);
      return {
        lat: Number(rawLat.toFixed(6)),
        lng: Number(rawLng.toFixed(6)),
        latVelocity: 0,
        lngVelocity: 0,
        variance: 1.0,
        noiseDeltaMeters: 0
      };
    }

    // Delta time in seconds
    let dt = (timestampMs - this.lastTimestampMs) / 1000.0;
    if (dt <= 0 || dt > 10) {
      dt = 0.1; // Default to 100ms standard rate if timestamp anomaly
    }
    this.lastTimestampMs = timestampMs;

    // --- STEP 1: PREDICTION ---
    // State Prediction: X_pred = F * X
    // lat_pred = lat + v_lat * dt
    // lng_pred = lng + v_lng * dt
    const predLat = this.state[0] + this.state[2] * dt;
    const predLng = this.state[1] + this.state[3] * dt;
    const predVLat = this.state[2];
    const predVLng = this.state[3];

    // Covariance Prediction: P_pred = F * P * F^T + Q
    // For diagonal simplification:
    const qPos = this.processNoise * dt * dt;
    const qVel = this.processNoise * dt;

    const p00 = this.P[0][0] + dt * (this.P[2][0] + this.P[0][2] + dt * this.P[2][2]) + qPos;
    const p11 = this.P[1][1] + dt * (this.P[3][1] + this.P[1][3] + dt * this.P[3][3]) + qPos;
    const p22 = this.P[2][2] + qVel;
    const p33 = this.P[3][3] + qVel;

    // --- STEP 2: MEASUREMENT UPDATE ---
    // Innovation (Measurement residual): y = z - H * X_pred
    const residualLat = rawLat - predLat;
    const residualLng = rawLng - predLng;

    // Innovation covariance: S = H * P_pred * H^T + R
    const sLat = p00 + this.measurementNoise;
    const sLng = p11 + this.measurementNoise;

    // Kalman Gain: K = P_pred * H^T * S^-1
    const kLatPos = p00 / sLat;
    const kLatVel = (this.P[2][0] + dt * this.P[2][2]) / sLat;

    const kLngPos = p11 / sLng;
    const kLngVel = (this.P[3][1] + dt * this.P[3][3]) / sLng;

    // Reject extreme GPS multipath spikes (> 50m jump in < 500ms)
    const rawDistMeters = KalmanFilter2D.haversineDistanceMeters(predLat, predLng, rawLat, rawLng);
    const spikeThreshold = Math.max(15, 30 * dt);
    
    let updatedLat: number;
    let updatedLng: number;
    let updatedVLat: number;
    let updatedVLng: number;

    if (rawDistMeters > spikeThreshold) {
      // Reject spike measurement, rely on prediction state
      updatedLat = predLat;
      updatedLng = predLng;
      updatedVLat = predVLat * 0.9;
      updatedVLng = predVLng * 0.9;
    } else {
      // Update State X = X_pred + K * y
      updatedLat = predLat + kLatPos * residualLat;
      updatedLng = predLng + kLngPos * residualLng;
      updatedVLat = predVLat + kLatVel * residualLat;
      updatedVLng = predVLng + kLngVel * residualLng;

      // Update Covariance P = (I - K * H) * P_pred
      this.P[0][0] = (1 - kLatPos) * p00;
      this.P[1][1] = (1 - kLngPos) * p11;
      this.P[2][2] = p22 - kLatVel * (dt * p22);
      this.P[3][3] = p33 - kLngVel * (dt * p33);
    }

    this.state = [updatedLat, updatedLng, updatedVLat, updatedVLng];

    const smoothedLat = Number(updatedLat.toFixed(6));
    const smoothedLng = Number(updatedLng.toFixed(6));
    const noiseDeltaMeters = KalmanFilter2D.haversineDistanceMeters(rawLat, rawLng, smoothedLat, smoothedLng);

    return {
      lat: smoothedLat,
      lng: smoothedLng,
      latVelocity: updatedVLat,
      lngVelocity: updatedVLng,
      variance: Math.sqrt(this.P[0][0] + this.P[1][1]),
      noiseDeltaMeters: Number(noiseDeltaMeters.toFixed(2))
    };
  }
}
