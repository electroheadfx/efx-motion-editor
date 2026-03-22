import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Star Nest by Pablo Roman Andrioli
// License: MIT

#define iterations 17
#define formuparam 0.53
#define volsteps 20
#define stepsize 0.1
#define tile 0.850

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv=fragCoord.xy/iResolution.xy-.5;
    uv.y*=iResolution.y/iResolution.x;
    vec3 dir=vec3(uv*u_zoom,1.);
    float time=iTime*u_speed+.25;

    // rotation from params
    float a1=.5+u_rotationX*2.;
    float a2=.8+u_rotationY*2.;
    mat2 rot1=mat2(cos(a1),sin(a1),-sin(a1),cos(a1));
    mat2 rot2=mat2(cos(a2),sin(a2),-sin(a2),cos(a2));
    dir.xz*=rot1;
    dir.xy*=rot2;
    vec3 from=vec3(1.,.5,0.5);
    from+=vec3(time*2.,time,-2.);
    from.xz*=rot1;
    from.xy*=rot2;

    float s=0.1,fade=1.;
    vec3 v=vec3(0.);
    for (int r=0; r<volsteps; r++) {
        vec3 p=from+s*dir*.5;
        p = abs(vec3(tile)-mod(p,vec3(tile*2.)));
        float pa,a=pa=0.;
        for (int i=0; i<iterations; i++) {
            p=abs(p)/dot(p,p)-formuparam;
            a+=abs(length(p)-pa);
            pa=length(p);
        }
        float dm=max(0.,u_darkmatter-a*a*.001);
        a*=a*a;
        if (r>6) fade*=1.-dm;
        v+=fade;
        v+=vec3(s,s*s,s*s*s*s)*a*u_brightness*fade;
        fade*=u_distfading;
        s+=stepsize;
    }
    v=mix(vec3(length(v)),v,u_saturation);
    fragColor = vec4(v*.01,1.);
}`;

export const starNest: ShaderDefinition = {
  id: 'star-nest',
  name: 'Star Nest',
  category: 'generator',
  description: 'Volumetric star field with dark matter and distance fading',
  author: 'Kali',
  license: 'MIT',
  url: 'https://www.shadertoy.com/view/XlfGRj',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 0.010, min: 0, max: 0.1, step: 0.001 },
    { key: 'zoom', label: 'Zoom', type: 'float', default: 0.800, min: 0.1, max: 3.0, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 0.0015, min: 0.0005, max: 0.01, step: 0.0005 },
    { key: 'darkmatter', label: 'Dark Matter', type: 'float', default: 0.300, min: 0, max: 1, step: 0.01 },
    { key: 'distfading', label: 'Dist Fading', type: 'float', default: 0.730, min: 0, max: 1, step: 0.01 },
    { key: 'saturation', label: 'Saturation', type: 'float', default: 0.850, min: 0, max: 1, step: 0.01 },
    { key: 'rotationX', label: 'Rotation X', type: 'float', default: 0.0, min: 0, max: 1, step: 0.01 },
    { key: 'rotationY', label: 'Rotation Y', type: 'float', default: 0.0, min: 0, max: 1, step: 0.01 },
  ],
};
