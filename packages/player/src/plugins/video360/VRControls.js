import { Matrix4 } from 'three';
import LogManager from '../../utils/LogManager';
import { SentryLogLevel } from '../../constants';

export class VRControls {
  constructor(object, onError) {
    const scope = this;
    let vrDisplay, vrDisplays;
    const standingMatrix = new Matrix4();
    let frameData = null;

    if ('VRFrameData' in window) {
      frameData = new VRFrameData();
    }

    function gotVRDisplays(displays) {
      vrDisplays = displays;
      if (displays.length > 0) {
        vrDisplay = displays[0];
      } else {
        if (onError) {
          onError('VR input not available.');
        }
      }
    }

    if (navigator.getVRDisplays) {
      navigator.getVRDisplays().then(gotVRDisplays).catch(function () {
        LogManager.message('THREE.VRControls: Unable to get VR Displays', SentryLogLevel.WARNING);
        console.warn('THREE.VRControls: Unable to get VR Displays');
      });
    }

    // the Rift SDK returns the position in meters
    // this scale factor allows the user to define how meters
    // are converted to scene units.

    this.scale = 1;

    // If true will use "standing space" coordinate system where y=0 is the
    // floor and x=0, z=0 is the center of the room.
    this.standing = false;

    // Distance from the users eyes to the floor in meters. Used when
    // standing=true but the VRDisplay doesn't provide stageParameters.
    this.userHeight = 1.6;

    this.getVRDisplay = function () {
      return vrDisplay;
    };

    this.setVRDisplay = function (value) {
      vrDisplay = value;
    };

    this.getVRDisplays = function () {
      console.warn('THREE.VRControls: getVRDisplays() is being deprecated.');

      return vrDisplays;
    };

    this.getStandingMatrix = function () {
      return standingMatrix;
    };

    this.update = function () {
      if (vrDisplay) {
        let pose;

        if (vrDisplay.getFrameData) {
          vrDisplay.getFrameData(frameData);
          pose = frameData.pose;
        } else if (vrDisplay.getPose) {
          pose = vrDisplay.getPose();
        }

        if (pose.orientation) {
          object.quaternion.fromArray(pose.orientation);
        }

        if (pose.position) {
          object.position.fromArray(pose.position);
        } else {
          object.position.set(0, 0, 0);
        }

        if (this.standing) {
          if (vrDisplay.stageParameters) {
            object.updateMatrix();
            standingMatrix.fromArray(vrDisplay.stageParameters.sittingToStandingTransform);
            object.applyMatrix(standingMatrix);
          } else {
            object.position.setY(object.position.y + this.userHeight);
          }
        }
        object.position.multiplyScalar(scope.scale);
      }
    };

    this.dispose = function () {
      vrDisplay = null;
    };
  }
}
