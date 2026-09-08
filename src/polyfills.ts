import 'react-native-get-random-values';
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from 'web-streams-polyfill';

const globals = globalThis as Record<string, unknown>;

if (globals.ReadableStream == null) {
  globals.ReadableStream = ReadableStream;
}
if (globals.WritableStream == null) {
  globals.WritableStream = WritableStream;
}
if (globals.TransformStream == null) {
  globals.TransformStream = TransformStream;
}
