#version 120

uniform sampler2D DiffuseSampler;

varying vec2 texCoord;
varying vec2 oneTexel;

uniform float Time;
uniform vec2 InSize;

const vec4 Zero = vec4(0.0);
const vec4 Half = vec4(0.5);
const vec4 One = vec4(1.0);
const vec4 Two = vec4(2.0);

const float Pi = 3.1415926535;
const float PincushionAmount = 0.01;
const float CurvatureAmount = 0.01;
const float ScanlineAmount = 0.8;
const float ScanlineScale = 1.0;
const float ScanlineHeight = 1.0;
const float ScanlineBrightScale = 1.0;
const float ScanlineBrightOffset = 0.0;
const float ScanlineOffset = 0.0;
const vec3 Floor = vec3(0.05, 0.05, 0.05);
const vec3 Power = vec3(0.8, 0.8, 0.8);

void main() {
    vec2 PinUnitCoord = texCoord * Two.xy - One.xy;
    float PincushionR2 = pow(length(PinUnitCoord), 2.0);
    vec2 PincushionCurve = PinUnitCoord * PincushionAmount * PincushionR2;
    vec2 ScanCoord = texCoord;
//*
    ScanCoord *= One.xy - PincushionAmount * 0.2;
    ScanCoord += PincushionAmount * 0.1;
    ScanCoord += PincushionCurve;

    vec2 CurvatureClipCurve = PinUnitCoord * CurvatureAmount * PincushionR2;
    vec2 ScreenClipCoord = texCoord;
    ScreenClipCoord -= Half.xy;
    ScreenClipCoord *= One.xy - CurvatureAmount * 0.2;
    ScreenClipCoord += Half.xy;
    ScreenClipCoord += CurvatureClipCurve;

    // -- Alpha Clipping --
    if (ScanCoord.x < 0.0) discard;
    if (ScanCoord.y < 0.0) discard;
    if (ScanCoord.x > 1.0) discard;
    if (ScanCoord.y > 1.0) discard;
//*/

    float noiseX = fract(sin(dot(mod((1 + mod(Time * 0.0000012, 1e2) + abs(ScanCoord)) * sign(ScanCoord) * 1e2, 6.283185), vec2(1.1e2, 1e3))) * 1e4);
    float noiseY = fract(sin(dot(mod((1 + mod(Time * 0.0000015, 1e2) + abs(ScanCoord)) * sign(ScanCoord) * 1e2, 6.283185), vec2(1.1e2, 1e3))) * 1e4);
    vec4 InTexel = texture2D(DiffuseSampler, texCoord + vec2(noiseX - 0.5, noiseY - 0.5) * 0.0015);

    // -- Scanline Simulation --
    float InnerSine = ScanCoord.y * InSize.y * ScanlineScale * 0.25;
    float ScanBrightMod = sin(InnerSine * Pi + ScanlineOffset * InSize.y * 0.25 - Time * Pi * 2.0);
    float ScanBrightness = mix(1.0, (pow(ScanBrightMod * ScanBrightMod, ScanlineHeight) * ScanlineBrightScale + 1.0) * 0.5, ScanlineAmount);
    vec3 ScanlineTexel = InTexel.rgb * ScanBrightness;

    // -- Color Compression (increasing the floor of the signal without affecting the ceiling) --
    ScanlineTexel = Floor + (One.xyz - Floor) * ScanlineTexel;

    float noise = fract(sin(dot(mod((1 + mod(Time * 1e-6, 1e2) + abs(ScanCoord)) * sign(ScanCoord) * 1e2, 6.283185), vec2(1.1e2, 1e3))) * 1e4);
    ScanlineTexel *= vec3(0.8, 0.9, 0.7) + noise * vec3(0.2, 0.1, 0.3);

    ScanlineTexel.rgb = pow(ScanlineTexel.rgb, Power);

    gl_FragColor = vec4(ScanlineTexel.rgb, 1.0);
}
