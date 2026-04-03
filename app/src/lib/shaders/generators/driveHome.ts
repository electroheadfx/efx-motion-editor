import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// "The Drive Home" by Martijn Steinrucken aka BigWings - 2017
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define S(x, y, z) smoothstep(x, y, z)
#define B(a, b, edge, t) S(a-edge, a+edge, t)*S(b+edge, b-edge, t)
#define sat(x) clamp(x,0.,1.)

#define streetLightCol vec3(1., .7, .3)
#define headLightCol vec3(.8, .8, 1.)
#define tailLightCol vec3(1., .1, .1)

#define HIGH_QUALITY
#define RAIN

vec3 ro, rd;

float N(float t) { return fract(sin(t*10234.324)*123423.23512); }
vec3 N31(float p) {
   vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
   p3 += dot(p3, p3.yzx + 19.19);
   return fract(vec3((p3.x+p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

float DistLine(vec3 ro, vec3 rd, vec3 p) { return length(cross(p-ro, rd)); }
vec3 ClosestPoint(vec3 ro, vec3 rd, vec3 p) { return ro + max(0., dot(p-ro, rd))*rd; }
float Remap(float a, float b, float c, float d, float t) { return ((t-a)/(b-a))*(d-c)+c; }

float BokehMask(vec3 ro, vec3 rd, vec3 p, float size, float blur) {
    float d = DistLine(ro, rd, p);
    float m = S(size, size*(1.-blur), d);
    m *= mix(.7, 1., S(.8*size, size, d));
    return m;
}

float SawTooth(float t) { return cos(t+cos(t))+sin(2.*t)*.2+sin(4.*t)*.02; }
float DeltaSawTooth(float t) { return 0.4*cos(2.*t)+0.08*cos(4.*t) - (1.-sin(t))*sin(t+cos(t)); }

vec2 GetDrops(vec2 uv, float seed, float m) {
    float t = iTime*u_speed+m*30.;
    vec2 o = vec2(0.);
    uv.y += t*.05;
    uv *= vec2(10., 2.5)*2.;
    vec2 id = floor(uv);
    vec3 n = N31(id.x + (id.y+seed)*546.3524);
    vec2 bd = fract(uv); bd -= .5; bd.y*=4.;
    bd.x += (n.x-.5)*.6;
    t += n.z * 6.28;
    float slide = SawTooth(t);
    float ts = 1.5;
    vec2 trailPos = vec2(bd.x*ts, (fract(bd.y*ts*2.-t*2.)-.5)*.5);
    bd.y += slide*2.;
    float dropShape = bd.x*bd.x;
    dropShape *= DeltaSawTooth(t);
    bd.y += dropShape;
    float d = length(bd);
    float trailMask = S(-.2, .2, bd.y); trailMask *= bd.y;
    float td = length(trailPos*max(.5, trailMask));
    float mainDrop = S(.2, .1, d);
    float dropTrail = S(.1, .02, td);
    dropTrail *= trailMask;
    o = mix(bd*mainDrop, trailPos, dropTrail);
    return o;
}

void CameraSetup(vec2 uv, vec3 pos, vec3 lookat, float zoom, float m) {
    ro = pos;
    vec3 f = normalize(lookat-ro);
    vec3 r = cross(vec3(0., 1., 0.), f);
    vec3 u = cross(f, r);
    float t = iTime*u_speed;
    vec2 offs = vec2(0.);
    vec2 dropUv = uv;
    float x = (sin(t*.1)*.5+.5)*.5; x = -x*x;
    float s = sin(x); float c = cos(x);
    mat2 rot = mat2(c, -s, s, c);
    dropUv = uv*rot;
    dropUv.x += -sin(t*.1)*.5;
    offs = GetDrops(dropUv, 1., m) * u_rainAmount;
    offs += GetDrops(dropUv*1.4, 10., m) * u_rainAmount;
    offs += GetDrops(dropUv*2.4, 25., m) * u_rainAmount;
    float ripple = sin(t+uv.y*3.1415*30.+uv.x*124.)*.5+.5;
    ripple *= .005;
    offs += vec2(ripple*ripple, ripple) * u_rainAmount;
    vec3 center = ro + f*zoom;
    vec3 i = center + (uv.x-offs.x)*r + (uv.y-offs.y)*u;
    rd = normalize(i-ro);
}

vec3 HeadLights(float i, float t) {
    float z = fract(-t*2.+i);
    vec3 p = vec3(-.3, .1, z*40.);
    float d = length(p-ro);
    float size = mix(.03, .05, S(.02, .07, z))*d;
    float m = 0.; float blur = .1;
    m += BokehMask(ro, rd, p-vec3(.08, 0., 0.), size, blur);
    m += BokehMask(ro, rd, p+vec3(.08, 0., 0.), size, blur);
    m += BokehMask(ro, rd, p+vec3(.1, 0., 0.), size, blur);
    m += BokehMask(ro, rd, p-vec3(.1, 0., 0.), size, blur);
    float distFade = max(.01, pow(1.-z, 9.));
    blur = .8; size *= 2.5; float r = 0.;
    r += BokehMask(ro, rd, p+vec3(-.09, -.2, 0.), size, blur);
    r += BokehMask(ro, rd, p+vec3(.09, -.2, 0.), size, blur);
    r *= distFade*distFade;
    return headLightCol*(m+r)*distFade;
}

vec3 TailLights(float i, float t) {
    t = t*1.5+i;
    float id = floor(t)+i;
    vec3 n = N31(id);
    float laneId = S(.5, .51, n.y);
    float ft = fract(t);
    float z = 3.-ft*3.;
    laneId *= S(.2, 1.5, z);
    float lane = mix(.6, .3, laneId);
    vec3 p = vec3(lane, .1, z);
    float d = length(p-ro);
    float size = .05*d; float blur = .1;
    float m = BokehMask(ro, rd, p-vec3(.08, 0., 0.), size, blur) +
              BokehMask(ro, rd, p+vec3(.08, 0., 0.), size, blur);
    float bs = n.z*3.;
    float brake = S(bs, bs+.01, z);
    brake *= S(bs+.01, bs, z-.5*n.y);
    m += (BokehMask(ro, rd, p+vec3(.1, 0., 0.), size, blur) +
          BokehMask(ro, rd, p-vec3(.1, 0., 0.), size, blur))*brake;
    float refSize = size*2.5;
    m += BokehMask(ro, rd, p+vec3(-.09, -.2, 0.), refSize, .8);
    m += BokehMask(ro, rd, p+vec3(.09, -.2, 0.), refSize, .8);
    vec3 col = tailLightCol*m*ft;
    float b = BokehMask(ro, rd, p+vec3(.12, 0., 0.), size, blur);
    b += BokehMask(ro, rd, p+vec3(.12, -.2, 0.), refSize, .8)*.2;
    vec3 blinker = vec3(1., .7, .2);
    blinker *= S(1.5, 1.4, z)*S(.2, .3, z);
    blinker *= sat(sin(t*200.)*100.);
    blinker *= laneId;
    col += blinker*b;
    return col;
}

vec3 StreetLights(float i, float t) {
    float side = sign(rd.x);
    float offset = max(side, 0.)*(1./16.);
    float z = fract(i-t+offset);
    vec3 p = vec3(2.*side, 2., z*60.);
    float d = length(p-ro);
    float distFade = Remap(1., .7, .1, 1.5, 1.-pow(1.-z,6.));
    distFade *= (1.-z);
    float m = BokehMask(ro, rd, p, .05*d, .1)*distFade;
    return m*streetLightCol;
}

vec3 EnvironmentLights(float i, float t) {
    float n = N(i+floor(t));
    float side = sign(rd.x);
    float offset = max(side, 0.)*(1./16.);
    float z = fract(i-t+offset+fract(n*234.));
    float n2 = fract(n*100.);
    vec3 p = vec3((3.+n)*side, n2*n2*n2*1., z*60.);
    float d = length(p-ro);
    float distFade = Remap(1., .7, .1, 1.5, 1.-pow(1.-z,6.));
    float m = BokehMask(ro, rd, p, .05*d, .1);
    m *= distFade*distFade*.5;
    m *= 1.-pow(sin(z*6.28*20.*n)*.5+.5, 20.);
    vec3 randomCol = vec3(fract(n*-34.5), fract(n*4572.), fract(n*1264.));
    vec3 col = mix(tailLightCol, streetLightCol, fract(n*-65.42));
    col = mix(col, randomCol, n);
    return m*col*.2;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float t = iTime * u_speed;
    vec3 col = vec3(0.);
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv -= .5;
    uv.x *= iResolution.x/iResolution.y;

    vec3 pos = vec3(.3, .15, 0.);
    float bt = t * 5.;
    float h1 = N(floor(bt)); float h2 = N(floor(bt+1.));
    float bumps = mix(h1, h2, fract(bt))*.1;
    bumps = bumps*bumps*bumps * u_camShake;
    pos.y += bumps;
    float lookatY = pos.y+bumps;
    vec3 lookat = vec3(0.3, lookatY, 1.);
    vec3 lookat2 = vec3(0., lookatY, .7);
    lookat = mix(lookat, lookat2, sin(t*.1)*.5+.5);
    uv.y += bumps*4.;
    CameraSetup(uv, pos, lookat, 2., 0.);

    t *= .03;

    float stp = 1./8.;
    for(float i=0.; i<1.; i+=stp) col += StreetLights(i, t);
    for(float i=0.; i<1.; i+=stp) { float n = N(i+floor(t)); col += HeadLights(i+n*stp*.7, t); }

    stp = 1./32.;
    for(float i=0.; i<1.; i+=stp) col += EnvironmentLights(i, t);

    col += TailLights(0., t);
    col += TailLights(.5, t);
    col += sat(rd.y)*vec3(.6, .5, .9);

    col *= u_brightness;
    fragColor = vec4(col, 1.);
}`;

export const driveHome: ShaderDefinition = {
  id: 'drive-home',
  name: 'The Drive Home',
  category: 'generator',
  description: 'Rainy night drive with bokeh traffic lights, rain drops, and camera shake',
  author: 'Martijn Steinrucken (BigWings)',
  license: 'CC BY-NC-SA 3.0',
  url: 'https://www.shadertoy.com/view/MdfBRX',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 1.0, min: 0.2, max: 3, step: 0.05 },
    { key: 'rainAmount', label: 'Rain', type: 'float', default: 1.0, min: 0, max: 2, step: 0.05 },
    { key: 'camShake', label: 'Cam Shake', type: 'float', default: 1.0, min: 0, max: 3, step: 0.1 },
  ],
};
