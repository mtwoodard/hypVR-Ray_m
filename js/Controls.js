/**
 * Based off code created by:
 * dmarcos / https://github.com/dmarcos
 * hawksley / https://github.com/hawksley 
 */

THREE.Controls = function(done){
   // this.phoneVR = new PhoneVR();
    var speed = 0.2;
    this.defaultPosition = new THREE.Vector3();
    this.manualRotateRate = new Float32Array([0.0, 0.0, 0.0]);
    this.manualMoveRate = new Float32Array([0.0, 0.0, 0.0]);
    this.updateTime = 0;
    
    this.manualControls = {
        65 : {index: 1, sign: 1, active: 0},  // a
        68 : {index: 1, sign: -1, active: 0}, // d
        87 : {index: 0, sign: 1, active: 0},  // w
        83 : {index: 0, sign: -1, active: 0}, // s
        81 : {index: 2, sign: -1, active: 0}, // q
        69 : {index: 2, sign: 1, active: 0},  // e
        38 : {index: 3, sign: 1, active: 0},  // up
        40 : {index: 3, sign: -1, active: 0}, // down
        37 : {index: 4, sign: -1, active: 0}, // left
        39 : {index: 4, sign: 1, active: 0},   // right
        222 : {index: 5, sign: 1, active: 0}, // single quote
        191 : {index: 5, sign: -1, active: 0},   // fwd slash
    };

    this.update = function(){
        var oldTime = this.updateTime;
        var newTime = Date.now();
        this.updateTime = newTime;

        //--------------------------------------------------------------------
        // Translation
        //--------------------------------------------------------------------
        var deltaTime = (newTime - oldTime) * 0.001;
        var deltaPosition = new THREE.Vector3();

        if(this.manualMoveRate[0] !== 0 || this.manualMoveRate[1] !== 0 || this.manualMoveRate[2] !== 0){
            deltaPosition = getFwdVector().multiplyScalar(speed * deltaTime * (this.manualMoveRate[0])).add(
                getRightVector().multiplyScalar(speed  * deltaTime * this.manualMoveRate[1])).add(
                getUpVector().multiplyScalar(speed  * deltaTime * this.manualMoveRate[2]));
        }
        if(deltaPosition !== undefined){
            var m = translateByVector(deltaPosition);
            g_currentBoost.premultiply(m);
        }

        var fixIndex = fixOutsideCentralCell(g_currentBoost); //moves camera back to main cell
        g_currentBoost.gramSchmidt();
        if(fixIndex !== -1){
           g_cellBoost = g_cellBoost.premultiply(invGens[fixIndex]); //keeps track of how many cells we've moved 
           g_cellBoost.gramSchmidt();
           g_invCellBoost.getInverse(g_cellBoost);
        }

        //--------------------------------------------------------------------
        // Rotation
        //--------------------------------------------------------------------
        var deltaRotation = new THREE.Quaternion(this.manualRotateRate[0] * speed * deltaTime,
                                                    this.manualRotateRate[1] * speed * deltaTime,
                                                    this.manualRotateRate[2] * speed * deltaTime, 1.0);
        
        //Handle Phone Input
        if(g_phoneOrient[0] !== null){
            var rotation = this.getQuatFromPhoneAngles(new THREE.Vector3().fromArray(g_phoneOrient));
            if(this.oldRotation === undefined) this.oldRotation = rotation;        
            deltaRotation = new THREE.Quaternion().multiplyQuaternions(this.oldRotation.inverse(), rotation);
	        this.oldRotation = rotation;
        }

        deltaRotation.normalize();
        
        if(deltaRotation !== undefined){
            m = new THREE.Matrix4().makeRotationFromQuaternion(deltaRotation.inverse());
            g_currentBoost.premultiply(m);
        }

        g_currentBoost.gramSchmidt();
        
    };
    
    //--------------------------------------------------------------------
    // Get phone orientation info
    //--------------------------------------------------------------------
    this.getScreenOrientation = function(){
        switch (window.screen.orientation || window.screen.mozOrientation) {
          case 'landscape-primary':
            return 90;
          case 'landscape-secondary':
            return -90;
          case 'portrait-secondary':
            return 180;
          case 'portrait-primary':
            return 0;
        }
        if (window.orientation !== undefined)
          return window.orientation;
    }
    
    
    this.getQuatFromPhoneAngles = function(angles) {
        var degtorad = Math.PI / 180; // Degree-to-Radian conversion
        var z = angles.z * degtorad / 2;
        var x = angles.x * degtorad / 2;
        var y = angles.y * degtorad / 2;
        var cX = Math.cos(x);
        var cY = Math.cos(y);
        var cZ = Math.cos(z);
        var sX = Math.sin(x);
        var sY = Math.sin(y);
        var sZ = Math.sin(z);
    
        // ZXY quaternion construction.
        var w = cX * cY * cZ - sX * sY * sZ;
        var x = sX * cY * cZ - cX * sY * sZ;
        var y = cX * sY * cZ + sX * cY * sZ;
        var z = cX * cY * sZ + sX * sY * cZ;
    
        var deviceQuaternion = new THREE.Quaternion(x, y, z, w);
    
        // Correct for the screen orientation.
        var screenOrientation = (this.getScreenOrientation() * degtorad)/2;
        var screenTransform = new THREE.Quaternion(0, 0, -Math.sin(screenOrientation), Math.cos(screenOrientation));
    
        var deviceRotation = new THREE.Quaternion();
        deviceRotation.multiplyQuaternions(deviceQuaternion, screenTransform);
    
        // deviceRotation is the quaternion encoding of the transformation
        // from camera coordinates to world coordinates.  The problem is that
        // our shader uses conventional OpenGL coordinates
        // (+x = right, +y = up, +z = backward), but the DeviceOrientation
        // spec uses different coordinates (+x = East, +y = North, +z = up).
        // To fix the mismatch, we need to fix this.  We'll arbitrarily choose
        // North to correspond to -z (the default camera direction).
        var r22 = Math.sqrt(0.5);
        deviceRotation.multiplyQuaternions(new THREE.Quaternion(-r22, 0, 0, r22), deviceRotation);
    
        return deviceRotation;
    }    
};